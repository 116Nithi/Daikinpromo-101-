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
  quoteMessageId?: string; // DB id (BigInt as string) of the message being quoted
}

// LINE quote tokens are valid for ~14 days. Reject quotes older than this.
const QUOTE_TOKEN_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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

  // 7 days for everything (GCS V4 max). Images / videos used to be 1 hour
  // because LINE caches them after the first fetch — but the LINE OA admin
  // chat history view re-fetches the original URL, so a short TTL caused
  // images to render as a broken-image placeholder a few hours after sending.
  const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days (GCS V4 max)
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
 * POST /api/admin/template-asset
 * Upload a single image/video to GCS for use inside a template. Unlike
 * adminUploadHandler this does NOT push to LINE — it just returns the
 * gs:// path so the frontend can store it in the template's localStorage
 * entry. The actual send happens later via /api/admin/send-template.
 *
 * Multipart fields:
 *   file       — the main image/video (required)
 *   thumbnail  — JPEG thumbnail for video (required when file is video)
 */
export async function adminTemplateAssetHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
    }
  }

  if (!mainFile) {
    reply.code(400).send({ error: "file is required" });
    return;
  }

  const isVideo = mainFile.mimetype.startsWith("video/");
  const isImage = mainFile.mimetype.startsWith("image/");
  if (!isImage && !isVideo) {
    reply.code(400).send({ error: "เฉพาะรูปภาพหรือวิดีโอเท่านั้น" });
    return;
  }

  const sizeLimit = isImage ? 10 * 1024 * 1024 : 200 * 1024 * 1024;
  if (mainFile.buffer.length > sizeLimit) {
    const sizeMB = (mainFile.buffer.length / 1024 / 1024).toFixed(2);
    const limitMB = (sizeLimit / 1024 / 1024).toFixed(0);
    reply.code(413).send({ error: `ไฟล์ใหญ่เกิน (${sizeMB} MB) — จำกัด ${limitMB} MB` });
    return;
  }

  if (isVideo && !thumbFile) {
    reply.code(400).send({ error: "วิดีโอต้องส่ง thumbnail มาด้วย" });
    return;
  }

  const baseId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mainPath = await uploadToGCS(baseId, mainFile.mimetype, mainFile.buffer);

  let thumbPath: string | undefined;
  if (isVideo && thumbFile) {
    thumbPath = await uploadToGCS(`${baseId}-thumb`, thumbFile.mimetype, thumbFile.buffer);
  }

  // Return a signed URL too so the frontend can preview the just-uploaded
  // asset without having to re-fetch (saves a round-trip in the editor).
  const previewUrl = await getSignedUrl(thumbPath ?? mainPath);

  reply.send({
    type: isImage ? "image" : "video",
    gcsPath: mainPath,
    thumbPath,
    previewUrl,
    mimetype: mainFile.mimetype,
  });
}

interface TemplateItem {
  type: "text" | "image" | "video";
  content?: string;   // for text
  gcsPath?: string;   // for image/video
  thumbPath?: string; // for video
}
interface TemplateSendBody {
  lineUserId: string;
  items: TemplateItem[];
}

/**
 * POST /api/admin/template-preview-urls
 * Batch re-sign gs:// paths to short-TTL preview URLs. Used by the editor /
 * send-preview modal to display real thumbnails for media stored in templates
 * (the previewUrl returned at upload time isn't persisted because signed URLs
 * expire and we'd just be storing dead links).
 */
export async function adminTemplatePreviewUrlsHandler(
  request: FastifyRequest<{ Body: { paths?: string[] } }>,
  reply: FastifyReply
): Promise<void> {
  const paths = Array.isArray(request.body?.paths) ? request.body.paths : [];
  // 1 hour is plenty — admin typically sends within seconds of opening preview
  const ttlMs = 60 * 60 * 1000;
  const urls: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      if (typeof p === "string" && p.startsWith("gs://")) {
        try {
          urls[p] = await getSignedUrl(p, ttlMs);
        } catch {
          // Skip — caller renders placeholder for any path we couldn't sign
        }
      }
    })
  );
  reply.send({ urls });
}

/**
 * POST /api/admin/send-template
 * Send a saved template (ordered list of text/image/video items) to a user.
 * Sends them in the order given — admin controls layout from the editor.
 * Re-signs each gs:// path to a fresh 7-day URL, builds LINE Message[],
 * pushes (chunked at 5/request per LINE limit), and logs each piece to DB.
 */
export async function adminSendTemplateHandler(
  request: FastifyRequest<{ Body: TemplateSendBody }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId, items } = request.body;

  if (!lineUserId) {
    reply.code(400).send({ error: "lineUserId required" });
    return;
  }
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    reply.code(400).send({ error: "ต้องมี item อย่างน้อยหนึ่งอย่าง" });
    return;
  }

  const ttlMs = 7 * 24 * 60 * 60 * 1000;
  const messages: messagingApi.Message[] = [];
  for (const item of safeItems) {
    if (item.type === "text" && item.content?.trim()) {
      messages.push({ type: "text", text: item.content });
    } else if (item.type === "image" && item.gcsPath) {
      const url = await getSignedUrl(item.gcsPath, ttlMs);
      messages.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
    } else if (item.type === "video" && item.gcsPath) {
      const url = await getSignedUrl(item.gcsPath, ttlMs);
      const thumbUrl = item.thumbPath ? await getSignedUrl(item.thumbPath, ttlMs) : url;
      messages.push({ type: "video", originalContentUrl: url, previewImageUrl: thumbUrl });
    }
  }

  if (messages.length === 0) {
    reply.code(400).send({ error: "ไม่มี item ที่ส่งได้" });
    return;
  }

  // LINE allows max 5 messages per push request — chunk if larger
  for (let i = 0; i < messages.length; i += 5) {
    await client.pushMessage({ to: lineUserId, messages: messages.slice(i, i + 5) });
  }

  // Log each piece to DB so it shows up in the admin chat history. Stagger
  // timestamps by 1ms so the SQL ORDER BY timestamp keeps the original order.
  const baseTime = Date.now();
  let offset = 0;
  for (const item of safeItems) {
    if (item.type === "text" && item.content?.trim()) {
      await prisma.conversation.create({
        data: {
          lineUserId,
          direction: "outbound_admin",
          messageType: "text",
          content: { type: "text", text: item.content, fromTemplate: true },
          isRead: true,
          timestamp: new Date(baseTime + offset++),
        },
      });
    } else if ((item.type === "image" || item.type === "video") && item.gcsPath) {
      await prisma.conversation.create({
        data: {
          lineUserId,
          direction: "outbound_admin",
          messageType: item.type,
          content: { type: item.type, fromTemplate: true },
          mediaUrl: item.gcsPath,
          isRead: true,
          timestamp: new Date(baseTime + offset++),
        },
      });
    }
  }

  reply.send({ status: "ok", count: messages.length });
}

/**
 * POST /api/admin/reply
 * Admin sends a message to a user via Push API + log to DB
 */
export async function adminReplyHandler(
  request: FastifyRequest<{ Body: ReplyBody }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId, message, quoteMessageId } = request.body;

  if (!lineUserId || !message) {
    reply.code(400).send({ error: "lineUserId and message are required" });
    return;
  }

  // Resolve the quoted message (if any) → fetch its quoteToken from DB.
  let quoteToken: string | undefined;
  let quotedMessageId: bigint | undefined;
  if (quoteMessageId) {
    const target = await prisma.conversation.findUnique({
      where: { id: BigInt(quoteMessageId) },
    });
    if (!target) {
      reply.code(404).send({ error: "ข้อความที่ต้องการ quote ไม่พบ" });
      return;
    }
    if (target.lineUserId !== lineUserId) {
      reply.code(400).send({ error: "ข้อความที่ quote ไม่ตรงกับ user ปลายทาง" });
      return;
    }
    if (!target.quoteToken) {
      reply.code(400).send({ error: "ข้อความนี้ไม่มี quote token (อาจเป็นข้อความเก่าก่อนเปิดฟีเจอร์ หรือไม่ใช่ข้อความที่ LINE ออก token ให้)" });
      return;
    }
    if (Date.now() - target.timestamp.getTime() > QUOTE_TOKEN_MAX_AGE_MS) {
      reply.code(400).send({ error: "Quote token หมดอายุ (เกิน 14 วัน) — กรุณาตอบกลับแบบไม่ quote" });
      return;
    }
    quoteToken = target.quoteToken;
    quotedMessageId = target.id;
  }

  // Send via Push API. quoteToken (if set) makes LINE render this as a quote-reply.
  const msg: messagingApi.TextMessage & { quoteToken?: string } = {
    type: "text",
    text: message,
  };
  if (quoteToken) msg.quoteToken = quoteToken;

  const pushRes = await client.pushMessage({
    to: lineUserId,
    messages: [msg],
  });

  // Capture LINE-issued quoteToken for the new outbound message so it can be
  // quoted later (admin replying to their own past message).
  const sentMessages = (pushRes as unknown as { sentMessages?: Array<{ quoteToken?: string }> }).sentMessages;
  const newQuoteToken = sentMessages?.[0]?.quoteToken;

  // Log to DB
  await prisma.conversation.create({
    data: {
      lineUserId,
      direction: "outbound_admin",
      messageType: "text",
      content: { type: "text", text: message },
      isRead: true,
      timestamp: new Date(),
      quoteToken: newQuoteToken,
      quotedMessageId,
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
  // MySQL doesn't support DISTINCT ON, use subquery instead.
  // LEFT JOIN chat_status so pin/spam come back with the list — saves a round-trip
  // and means the sidebar renders correctly on first paint.
  const conversations = (await prisma.$queryRaw`
    SELECT
      c.line_user_id AS lineUserId,
      c.direction,
      c.message_type AS messageType,
      c.content,
      c.timestamp,
      COALESCE(s.pinned, FALSE)  AS pinned,
      s.pinned_at                AS pinnedAt,
      COALESCE(s.is_spam, FALSE) AS isSpam
    FROM conversations c
    INNER JOIN (
      SELECT line_user_id, MAX(timestamp) AS max_ts
      FROM conversations
      GROUP BY line_user_id
    ) latest ON c.line_user_id = latest.line_user_id AND c.timestamp = latest.max_ts
    LEFT JOIN chat_status s ON s.line_user_id = c.line_user_id
    ORDER BY c.timestamp DESC
  `) as Array<{
    lineUserId: string;
    direction: string;
    messageType: string;
    content: unknown;
    timestamp: Date;
    pinned: number | boolean;
    pinnedAt: Date | null;
    isSpam: number | boolean;
  }>;

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
        lineUserId: c.lineUserId,
        direction: c.direction,
        messageType: c.messageType,
        content: c.content,
        timestamp: c.timestamp,
        displayName,
        pictureUrl,
        unreadCount: unreadMap.get(c.lineUserId) ?? 0,
        // MySQL returns BOOLEAN as tinyint(1) — coerce to real boolean for the client
        pinned: Boolean(c.pinned),
        pinnedAt: c.pinnedAt,
        isSpam: Boolean(c.isSpam),
      };
    })
  );

  reply.send(withProfiles);
}

/**
 * PATCH /api/admin/chat-status/:lineUserId
 * Upsert per-user chat-level status (pin / spam). Body fields are optional —
 * only the ones provided are touched, the rest keep their current value.
 * Shared across all admins (state lives in DB, not browser localStorage).
 */
export async function updateChatStatusHandler(
  request: FastifyRequest<{
    Params: { lineUserId: string };
    Body: { pinned?: boolean; isSpam?: boolean };
  }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { pinned, isSpam } = request.body ?? {};

  if (pinned === undefined && isSpam === undefined) {
    reply.code(400).send({ error: "ต้องระบุ pinned หรือ isSpam อย่างน้อย 1 อย่าง" });
    return;
  }

  // Track when a chat was pinned so the sidebar can sort by pin time
  const pinnedAt = pinned === true ? new Date() : pinned === false ? null : undefined;

  const row = await prisma.chatStatus.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      pinned: pinned ?? false,
      pinnedAt: pinned === true ? new Date() : null,
      isSpam: isSpam ?? false,
    },
    update: {
      ...(pinned !== undefined && { pinned, pinnedAt }),
      ...(isSpam !== undefined && { isSpam }),
    },
  });

  reply.send({
    lineUserId: row.lineUserId,
    pinned: row.pinned,
    pinnedAt: row.pinnedAt,
    isSpam: row.isSpam,
  });
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

  // Build response objects WITHOUT spread to avoid leaking BigInts that the
  // default Fastify serializer can't handle. Casts to `any` for the new
  // optional fields so this works even if a stale Prisma client is loaded.
  const messages = await Promise.all(
    rawMessages.map(async (m) => {
      const anyM = m as unknown as Record<string, unknown>;
      const qmid = anyM.quotedMessageId;
      return {
        id: m.id.toString(),
        lineUserId: m.lineUserId,
        direction: m.direction,
        messageType: m.messageType,
        content: m.content,
        mediaUrl: m.mediaUrl?.startsWith("gs://")
          ? await getSignedUrl(m.mediaUrl)
          : m.mediaUrl,
        replyToken: m.replyToken,
        sourceType: m.sourceType,
        sourceId: m.sourceId,
        isRead: m.isRead,
        timestamp: m.timestamp,
        createdAt: m.createdAt,
        quoteToken: (anyM.quoteToken as string | null | undefined) ?? null,
        quotedMessageId: qmid != null ? String(qmid) : null,
      };
    })
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

/**
 * DELETE /api/admin/conversations/:lineUserId
 * Hard-delete every message row for the given user (entire chat history) plus
 * any chat_status row for this user. GCS media files are intentionally left
 * in place — they can be pruned by a separate cleanup job later.
 */
export async function deleteConversationHandler(
  request: FastifyRequest<{ Params: ConversationParams }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const result = await prisma.conversation.deleteMany({ where: { lineUserId } });
  await prisma.chatStatus.deleteMany({ where: { lineUserId } });
  reply.send({ status: "ok", deleted: result.count });
}
