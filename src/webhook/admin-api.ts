import { FastifyRequest, FastifyReply } from "fastify";
import "@fastify/multipart";
import { messagingApi } from "@line/bot-sdk";
import { prisma } from "../database/prisma";
import { env } from "../config/env";
import { getSignedUrl, uploadToGCS } from "../shared/gcs-client";

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
 * POST /api/admin/upload
 * Admin uploads a file to send to a user via Push API + log to DB.
 *   - image/* → LINE image message
 *   - video/* → LINE video message (requires thumbnail part)
 *   - everything else → LINE text message with a signed download link (valid 7 days)
 */
export async function adminUploadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  let lineUserId: string | undefined;
  let mainFile: { buffer: Buffer; mimetype: string; filename: string } | undefined;
  let thumbFile: { buffer: Buffer; mimetype: string } | undefined;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (part.fieldname === "file") {
        mainFile = { buffer, mimetype: part.mimetype, filename: part.filename };
      } else if (part.fieldname === "thumbnail") {
        thumbFile = { buffer, mimetype: part.mimetype };
      }
    } else if (part.fieldname === "lineUserId") {
      lineUserId = part.value as string;
    }
  }

  if (!lineUserId || !mainFile) {
    reply.code(400).send({ error: "lineUserId and file are required" });
    return;
  }

  const isVideo = mainFile.mimetype.startsWith("video/");
  const isImage = mainFile.mimetype.startsWith("image/");

  const sizeLimit = isImage
    ? 10 * 1024 * 1024   // 10MB (LINE image cap)
    : isVideo
      ? 200 * 1024 * 1024 // 200MB (LINE video cap)
      : 50 * 1024 * 1024; // 50MB (document)
  if (mainFile.buffer.length > sizeLimit) {
    const kind = isImage ? "image" : isVideo ? "video" : "file";
    const sizeMB = (mainFile.buffer.length / 1024 / 1024).toFixed(2);
    const limitMB = (sizeLimit / 1024 / 1024).toFixed(0);
    reply.code(413).send({ error: `File too large (${sizeMB} MB). Limit for ${kind}: ${limitMB} MB` });
    return;
  }

  if (isVideo && !thumbFile) {
    reply.code(400).send({ error: "thumbnail is required for video uploads" });
    return;
  }

  const baseId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mainPath = await uploadToGCS(baseId, mainFile.mimetype, mainFile.buffer);
  const messageType = isImage ? "image" : isVideo ? "video" : "file";

  // Files (non-image/video) need a long-lived link since the user may open it later.
  const ttlMs = messageType === "file"
    ? 7 * 24 * 60 * 60 * 1000 // 7 days (GCS V4 max)
    : 60 * 60 * 1000;         // 1 hour
  const mainUrl = await getSignedUrl(mainPath, ttlMs);

  let message: messagingApi.Message;
  if (isImage) {
    message = {
      type: "image",
      originalContentUrl: mainUrl,
      previewImageUrl: mainUrl,
    };
  } else if (isVideo) {
    const thumbPath = await uploadToGCS(`${baseId}-thumb`, thumbFile!.mimetype, thumbFile!.buffer);
    const thumbUrl = await getSignedUrl(thumbPath);
    message = {
      type: "video",
      originalContentUrl: mainUrl,
      previewImageUrl: thumbUrl,
    };
  } else {
    const sizeMB = (mainFile.buffer.length / 1024 / 1024).toFixed(2);
    message = {
      type: "text",
      text: `📎 ไฟล์: ${mainFile.filename} (${sizeMB} MB)\nดาวน์โหลด (ลิงก์หมดอายุใน 7 วัน):\n${mainUrl}`,
    };
  }

  await client.pushMessage({ to: lineUserId, messages: [message] });

  await prisma.conversation.create({
    data: {
      lineUserId,
      direction: "outbound_admin",
      messageType,
      content: { type: messageType, filename: mainFile.filename },
      mediaUrl: mainPath,
      isRead: true,
      timestamp: new Date(),
    },
  });

  reply.send({ status: "ok", type: messageType });
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
      isRead: true,
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

  // Unread = inbound messages with isRead = false.
  // Mark-as-read happens when admin opens the conversation (PATCH .../read).
  const unreadRows = await prisma.conversation.groupBy({
    by: ["lineUserId"],
    where: { direction: "inbound", isRead: false },
    _count: { _all: true },
  });

  const unreadMap = new Map<string, number>();
  for (const r of unreadRows) {
    unreadMap.set(r.lineUserId, r._count._all);
  }

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
      return {
        ...c,
        displayName,
        pictureUrl,
        unreadCount: unreadMap.get(c.lineUserId) ?? 0,
      };
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

/**
 * PATCH /api/admin/conversations/:lineUserId/read
 * Mark all inbound messages from this user as read.
 * Called when admin opens the conversation in the UI.
 */
export async function markConversationReadHandler(
  request: FastifyRequest<{ Params: ConversationParams }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;

  const result = await prisma.conversation.updateMany({
    where: { lineUserId, direction: "inbound", isRead: false },
    data: { isRead: true },
  });

  reply.send({ status: "ok", updated: result.count });
}
