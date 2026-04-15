import { FastifyRequest, FastifyReply } from "fastify";
import { messagingApi } from "@line/bot-sdk";
import { prisma } from "../database/prisma";
import { env } from "../config/env";
import { getSignedUrl } from "../shared/gcs-client";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

interface ReplyBody {
  lineUserId: string;
  message: string;
}

interface ConversationParams {
  lineUserId: string;
}

interface ConversationQuery {
  limit?: string;
  offset?: string;
}

/**
 * POST /api/admin/reply
 * Admin sends a message to a user via Push API + log to DB
 */
export async function adminReplyHandler(
  request: FastifyRequest<{ Body: ReplyBody }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId, message } = request.body;

  if (!lineUserId || !message) {
    reply.code(400).send({ error: "lineUserId and message are required" });
    return;
  }

  // Send via Push API
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text: message }],
  });

  // Log to DB
  await prisma.conversation.create({
    data: {
      lineUserId,
      direction: "outbound_admin",
      messageType: "text",
      content: { type: "text", text: message },
      timestamp: new Date(),
    },
  });

  reply.send({ status: "ok" });
}

/**
 * GET /api/admin/conversations
 * List all unique users with their latest message
 */
export async function listConversationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // MySQL doesn't support DISTINCT ON, use subquery instead
  const conversations = (await prisma.$queryRaw`
    SELECT
      c.line_user_id AS lineUserId,
      c.direction,
      c.message_type AS messageType,
      c.content,
      c.timestamp
    FROM conversations c
    INNER JOIN (
      SELECT line_user_id, MAX(timestamp) AS max_ts
      FROM conversations
      GROUP BY line_user_id
    ) latest ON c.line_user_id = latest.line_user_id AND c.timestamp = latest.max_ts
    ORDER BY c.timestamp DESC
  `) as Array<{ lineUserId: string; direction: string; messageType: string; content: unknown; timestamp: Date }>;

  // Fetch LINE profiles for all users
  const withProfiles = await Promise.all(
    conversations.map(async (c) => {
      let displayName = c.lineUserId;
      let pictureUrl: string | null = null;
      try {
        const profile = await client.getProfile(c.lineUserId);
        displayName = profile.displayName;
        pictureUrl = profile.pictureUrl ?? null;
      } catch {
        // User may have blocked the OA
      }
      return { ...c, displayName, pictureUrl };
    })
  );

  reply.send(withProfiles);
}

/**
 * GET /api/admin/conversations/:lineUserId
 * Get all messages for a specific user
 */
export async function getConversationHandler(
  request: FastifyRequest<{ Params: ConversationParams; Querystring: ConversationQuery }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const limit = parseInt(request.query.limit ?? "50", 10);
  const offset = parseInt(request.query.offset ?? "0", 10);

  const rawMessages = await prisma.conversation.findMany({
    where: { lineUserId },
    orderBy: { timestamp: "asc" },
    take: limit,
    skip: offset,
  });

  // Convert BigInt id to string and generate signed URLs for media
  const messages = await Promise.all(
    rawMessages.map(async (m) => ({
      ...m,
      id: m.id.toString(),
      mediaUrl: m.mediaUrl?.startsWith("gs://")
        ? await getSignedUrl(m.mediaUrl)
        : m.mediaUrl,
    }))
  );

  // Get user profile from LINE
  let profile = null;
  try {
    profile = await client.getProfile(lineUserId);
  } catch {
    // User may have blocked the OA
  }

  reply.send({ profile, messages });
}
