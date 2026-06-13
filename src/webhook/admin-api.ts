import { FastifyRequest, FastifyReply } from "fastify";
import "@fastify/multipart";
import { messagingApi } from "@line/bot-sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { env } from "../config/env";
import { getSignedUrl, getSignedUrlLocal, uploadToGCS } from "../shared/gcs-client";
import { isAiEnabled, setAiEnabled, isUserAiEnabled, setUserAiEnabled } from "../shared/ai-settings";

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

interface NoteCategoryInput {
  key: string;
  label: string;
  color: string;
}

interface UserNoteInput {
  id?: string;
  category: string;
  customLabel?: string;
  body: string;
  author?: string;
  createdAt?: string;
}

interface TemplateInput {
  key: string;
  items: unknown[];
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

  // Best-effort displayName so storage lands in "{userId} ({name})" folder.
  let displayName: string | undefined;
  try {
    const profile = await client.getProfile(lineUserId);
    displayName = profile.displayName;
  } catch (err) {
    request.log.warn({ err, lineUserId }, "getProfile failed; uploading with ID-only folder");
  }

  const mainPath = await uploadToGCS(baseId, mainFile.mimetype, mainFile.buffer, lineUserId, displayName);
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
    const thumbPath = await uploadToGCS(`${baseId}-thumb`, thumbFile!.mimetype, thumbFile!.buffer, lineUserId, displayName);
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

  let pushRes;
  try {
    pushRes = await client.pushMessage({ to: lineUserId, messages: [message] });
  } catch (lineErr: unknown) {
    const detail = lineErr instanceof Error ? lineErr.message : String(lineErr);
    reply.code(502).send({ error: `LINE API error: ${detail}` });
    return;
  }

  // Capture LINE-issued quoteToken so admin can later quote-reply this media
  // message. LINE issues tokens for image/video/audio/file/text — basically
  // every type adminUploadHandler emits.
  const sentMessages = (pushRes as unknown as { sentMessages?: Array<{ quoteToken?: string }> }).sentMessages;
  const newQuoteToken = sentMessages?.[0]?.quoteToken;

  await prisma.conversation.create({
    data: {
      lineUserId,
      direction: "outbound_admin",
      messageType,
      content: { type: messageType, filename: mainFile.filename },
      mediaUrl: mainPath,
      isRead: true,
      timestamp: new Date(),
      quoteToken: newQuoteToken,
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
  // Use the local variant — this URL is consumed by the admin browser, not LINE.
  const previewUrl = await getSignedUrlLocal(thumbPath ?? mainPath);

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
      if (typeof p === "string" && (p.startsWith("gs://") || p.startsWith("s3://"))) {
        // s3:// rows can still exist in the DB from the brief MinIO experiment;
        // getSignedUrl treats them as gs:// paths so the admin can still view them.
        try {
          // Local variant — these URLs render <img> tags in the admin browser.
          urls[p] = await getSignedUrlLocal(p, ttlMs);
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
  // Items that survived validation, aligned 1:1 with `messages` so we can map
  // LINE's per-message quoteToken response back onto the right DB row.
  const validItems: TemplateItem[] = [];
  for (const item of safeItems) {
    if (item.type === "text" && item.content?.trim()) {
      messages.push({ type: "text", text: item.content });
      validItems.push(item);
    } else if (item.type === "image" && item.gcsPath) {
      const url = await getSignedUrl(item.gcsPath, ttlMs);
      messages.push({ type: "image", originalContentUrl: url, previewImageUrl: url });
      validItems.push(item);
    } else if (item.type === "video" && item.gcsPath) {
      const url = await getSignedUrl(item.gcsPath, ttlMs);
      const thumbUrl = item.thumbPath ? await getSignedUrl(item.thumbPath, ttlMs) : url;
      messages.push({ type: "video", originalContentUrl: url, previewImageUrl: thumbUrl });
      validItems.push(item);
    }
  }

  if (messages.length === 0) {
    reply.code(400).send({ error: "ไม่มี item ที่ส่งได้" });
    return;
  }

  // LINE allows max 5 messages per push request — chunk if larger.
  // Capture the per-message quoteToken from each chunk so admin can later
  // quote-reply individual items in the template.
  const quoteTokens: (string | undefined)[] = new Array(messages.length).fill(undefined);
  for (let i = 0; i < messages.length; i += 5) {
    let pushRes;
    try {
      pushRes = await client.pushMessage({
        to: lineUserId,
        messages: messages.slice(i, i + 5),
      });
    } catch (lineErr: unknown) {
      const detail = lineErr instanceof Error ? lineErr.message : String(lineErr);
      reply.code(502).send({ error: `LINE API error: ${detail}` });
      return;
    }
    const sentMessages = (pushRes as unknown as { sentMessages?: Array<{ quoteToken?: string }> }).sentMessages;
    if (sentMessages) {
      for (let j = 0; j < sentMessages.length; j++) {
        quoteTokens[i + j] = sentMessages[j]?.quoteToken;
      }
    }
  }

  // Log each piece to DB so it shows up in the admin chat history. Stagger
  // timestamps by 1ms so the SQL ORDER BY timestamp keeps the original order.
  const baseTime = Date.now();
  for (let idx = 0; idx < validItems.length; idx++) {
    const item = validItems[idx];
    const qt = quoteTokens[idx];
    if (item.type === "text" && item.content?.trim()) {
      await prisma.conversation.create({
        data: {
          lineUserId,
          direction: "outbound_admin",
          messageType: "text",
          content: { type: "text", text: item.content, fromTemplate: true },
          isRead: true,
          timestamp: new Date(baseTime + idx),
          quoteToken: qt,
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
          timestamp: new Date(baseTime + idx),
          quoteToken: qt,
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

  // Resolve the quoted message (if any). We always remember `quotedMessageId`
  // so admin's chat history shows the relationship — even when LINE itself
  // can't render a native quote box (no token / token expired).
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
    quotedMessageId = target.id;

    // Token present + fresh (≤14d, the LINE-imposed lifetime) → real LINE quote.
    // Anything else (missing token, or expired) silently falls through to a
    // plain text reply. Frontend already warns the admin in the banner before
    // they hit send, so we don't surface an error here.
    if (
      target.quoteToken &&
      Date.now() - target.timestamp.getTime() <= QUOTE_TOKEN_MAX_AGE_MS
    ) {
      quoteToken = target.quoteToken;
    }
  }

  // Send via Push API. quoteToken (if set) makes LINE render this as a quote-reply.
  const msg: messagingApi.TextMessage & { quoteToken?: string } = {
    type: "text",
    text: message,
  };
  if (quoteToken) msg.quoteToken = quoteToken;

  let pushRes;
  try {
    pushRes = await client.pushMessage({
      to: lineUserId,
      messages: [msg],
    });
  } catch (lineErr: unknown) {
    // Expose LINE API error to the browser so admin sees a real message
    // instead of the generic "fetch failed" that occurs when the server drops
    // the connection on an unhandled throw.
    const detail = lineErr instanceof Error ? lineErr.message : String(lineErr);
    reply.code(502).send({ error: `LINE API error: ${detail}` });
    return;
  }

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
      c.display_name AS displayName,
      COALESCE(s.pinned, FALSE)       AS pinned,
      s.pinned_at                     AS pinnedAt,
      COALESCE(s.is_spam, FALSE)      AS isSpam,
      COALESCE(s.needs_admin, FALSE)  AS needsAdmin
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
    displayName: string | null;
    pinned: number | boolean;
    pinnedAt: Date | null;
    isSpam: number | boolean;
    needsAdmin: number | boolean;
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

  // pictureUrl + displayName fallback จาก user_profiles
  // user_profiles ถูก populate จาก LINE getProfile (event-processor + chat-detail)
  // → มีชื่อจริงเสมอ (ถ้า user ไม่ block OA)
  const userIds = conversations.map(c => c.lineUserId);
  const profileRows = await prisma.userProfile.findMany({
    where: { lineUserId: { in: userIds } },
    select: { lineUserId: true, pictureUrl: true, displayName: true },
  });
  const profileMap = new Map(profileRows.map(p => [p.lineUserId, p]));

  const withProfiles = conversations.map(c => {
    const cached = profileMap.get(c.lineUserId);
    return {
      lineUserId: c.lineUserId,
      direction: c.direction,
      messageType: c.messageType,
      content: c.content,
      timestamp: c.timestamp,
      // Priority:
      // 1. user_profiles.displayName — มาจาก LINE getProfile โดยตรง ชื่อจริง
      // 2. conversations.display_name — บันทึกตอน insert message
      // 3. LINE ID — สุดท้ายถ้าไม่มีอะไร
      displayName: cached?.displayName ?? c.displayName ?? c.lineUserId,
      pictureUrl: cached?.pictureUrl ?? null,
      unreadCount: unreadMap.get(c.lineUserId) ?? 0,
      // MySQL returns BOOLEAN as tinyint(1) — coerce to real boolean for the client
      pinned: Boolean(c.pinned),
      pinnedAt: c.pinnedAt,
      isSpam: Boolean(c.isSpam),
      needsAdmin: Boolean(c.needsAdmin),
    };
  });

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
    Body: { pinned?: boolean; isSpam?: boolean; needsAdmin?: boolean };
  }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { pinned, isSpam, needsAdmin } = request.body ?? {};

  if (pinned === undefined && isSpam === undefined && needsAdmin === undefined) {
    reply.code(400).send({ error: "ต้องระบุ pinned, isSpam หรือ needsAdmin อย่างน้อย 1 อย่าง" });
    return;
  }

  const pinnedAt = pinned === true ? new Date() : pinned === false ? null : undefined;

  const row = await (prisma.chatStatus.upsert as (args: unknown) => Promise<unknown>)({
    where: { lineUserId },
    create: {
      lineUserId,
      pinned: pinned ?? false,
      pinnedAt: pinned === true ? new Date() : null,
      isSpam: isSpam ?? false,
      needsAdmin: needsAdmin ?? false,
    },
    update: {
      ...(pinned !== undefined && { pinned, pinnedAt }),
      ...(isSpam !== undefined && { isSpam }),
      ...(needsAdmin !== undefined && { needsAdmin }),
    },
  }) as Awaited<ReturnType<typeof prisma.chatStatus.upsert>>;

  const r = row as typeof row & { needsAdmin?: boolean };
  reply.send({
    lineUserId: row.lineUserId,
    pinned: row.pinned,
    pinnedAt: row.pinnedAt,
    isSpam: row.isSpam,
    needsAdmin: Boolean(r.needsAdmin),
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
  const limit = parseInt(request.query.limit ?? "500", 10);
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
        mediaUrl: (m.mediaUrl?.startsWith("gs://") || m.mediaUrl?.startsWith("s3://"))
          ? await getSignedUrlLocal(m.mediaUrl)
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
    // Cache ลง user_profiles เพื่อให้ list query ครั้งหน้าได้ชื่อจริง
    // (ก่อนหน้านี้ดึง live แต่ไม่ persist → list ยังโชว์ LINE ID เปล่า)
    if (profile?.displayName) {
      await prisma.userProfile.upsert({
        where: { lineUserId },
        create: {
          lineUserId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        },
        update: {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        },
      });
    }
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

function cleanColor(raw: unknown): string {
  const color = String(raw ?? "");
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#5f6368";
}

function cleanKey(raw: unknown, fallbackPrefix: string): string {
  const key = String(raw ?? "").trim().replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 80);
  return key || `${fallbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listNoteCategoriesHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const rows = await prisma.noteCategory.findMany({ orderBy: { createdAt: "asc" } });
  reply.send(rows.map((r) => ({ key: r.key, label: r.label, color: r.color })));
}

export async function replaceNoteCategoriesHandler(
  request: FastifyRequest<{ Body: { categories?: NoteCategoryInput[] } }>,
  reply: FastifyReply
): Promise<void> {
  const categories = Array.isArray(request.body?.categories) ? request.body.categories : [];
  const clean = categories
    .map((c) => ({
      key: cleanKey(c.key, "cat"),
      label: String(c.label ?? "").trim().slice(0, 120),
      color: cleanColor(c.color),
    }))
    .filter((c) => c.label.length > 0);

  await prisma.$transaction([
    prisma.noteCategory.deleteMany(),
    prisma.noteCategory.createMany({ data: clean, skipDuplicates: true }),
  ]);
  reply.send({ status: "ok", categories: clean });
}

export async function listNotesHandler(
  request: FastifyRequest<{ Querystring: { lineUserId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const where = request.query.lineUserId ? { lineUserId: request.query.lineUserId } : {};
  const rows = await prisma.userNote.findMany({
    where,
    orderBy: [{ lineUserId: "asc" }, { createdAt: "asc" }],
  });
  reply.send(rows.map((n) => ({
    id: n.id,
    lineUserId: n.lineUserId,
    category: n.category,
    customLabel: n.customLabel,
    body: n.body,
    author: n.author,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  })));
}

export async function upsertNoteHandler(
  request: FastifyRequest<{ Body: UserNoteInput & { lineUserId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const lineUserId = request.body?.lineUserId;
  // body (รายละเอียด) เป็น optional — เก็บ empty string ก็ได้ ไม่ block validate
  const body = String(request.body?.body ?? "").trim();
  const category = String(request.body?.category ?? "").trim().slice(0, 80);
  if (!lineUserId || !category) {
    reply.code(400).send({ error: "lineUserId and category are required" });
    return;
  }

  const id = cleanKey(request.body.id, "note");
  const createdAt = request.body.createdAt ? new Date(request.body.createdAt) : new Date();
  const row = await prisma.userNote.upsert({
    where: { id },
    create: {
      id,
      lineUserId,
      category,
      customLabel: request.body.customLabel ? String(request.body.customLabel).slice(0, 120) : null,
      body: body.slice(0, 5000),
      author: String(request.body.author || "Admin").slice(0, 80),
      createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
    },
    update: {
      category,
      customLabel: request.body.customLabel ? String(request.body.customLabel).slice(0, 120) : null,
      body: body.slice(0, 5000),
      author: String(request.body.author || "Admin").slice(0, 80),
    },
  });

  reply.send({
    id: row.id,
    lineUserId: row.lineUserId,
    category: row.category,
    customLabel: row.customLabel,
    body: row.body,
    author: row.author,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function deleteNoteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  await prisma.userNote.deleteMany({ where: { id: request.params.id } });
  reply.send({ status: "ok" });
}

export async function listTemplatesHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const rows = await prisma.messageTemplate.findMany({ orderBy: { createdAt: "asc" } });
  reply.send(rows.map((t) => ({ key: t.key, items: t.items })));
}

export async function replaceTemplatesHandler(
  request: FastifyRequest<{ Body: { templates?: TemplateInput[] } }>,
  reply: FastifyReply
): Promise<void> {
  const templates = Array.isArray(request.body?.templates) ? request.body.templates : [];
  const clean = templates
    .map((t) => ({
      key: cleanKey(t.key, "tpl"),
      items: (Array.isArray(t.items) ? t.items.slice(0, 5) : []) as Prisma.InputJsonValue,
    }))
    .filter((t) => Array.isArray(t.items) && t.items.length > 0)
    .slice(0, 20);

  await prisma.$transaction([
    prisma.messageTemplate.deleteMany(),
    ...clean.map((t) => prisma.messageTemplate.create({ data: t })),
  ]);
  reply.send({ status: "ok", templates: clean });
}

interface ChatAiParams { lineUserId: string; }

export async function getAiGlobalSettingHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.send({ enabled: isAiEnabled() });
}

export async function setAiGlobalSettingHandler(
  request: FastifyRequest<{ Body: { enabled: boolean } }>,
  reply: FastifyReply
): Promise<void> {
  setAiEnabled(!!request.body.enabled);
  reply.send({ enabled: isAiEnabled() });
}

export async function getChatAiHandler(
  request: FastifyRequest<{ Params: ChatAiParams }>,
  reply: FastifyReply
): Promise<void> {
  reply.send({ enabled: isUserAiEnabled(request.params.lineUserId) });
}

export async function setChatAiHandler(
  request: FastifyRequest<{ Params: ChatAiParams; Body: { enabled: boolean } }>,
  reply: FastifyReply
): Promise<void> {
  setUserAiEnabled(request.params.lineUserId, !!request.body.enabled);
  reply.send({ enabled: isUserAiEnabled(request.params.lineUserId) });
}

// Core backfill logic — shared by the HTTP handler and the startup auto-run.
// Fetches LINE profiles for all users with no cached entry in user_profiles,
// in batches of 10 with 300ms gaps to stay under LINE's rate limit.
export async function runBackfillProfiles(): Promise<void> {
  // ดึง user ที่ profile ยังว่าง / ไม่ครบ — รวม 3 เคส:
  //   1. ไม่มี row ใน user_profiles เลย (เคสเดิม)
  //   2. มี row แต่ displayName เป็น NULL
  //   3. มี row แต่ displayName เป็น raw LINE ID (U + hex) เช่นค่าเก่าค้าง
  // ทั้ง 3 กรณีจะถูก getProfile + upsert ทับด้วยชื่อจริงจาก LINE
  const allUserIds = await prisma.$queryRaw<Array<{ lineUserId: string }>>`
    SELECT DISTINCT c.line_user_id AS lineUserId
    FROM conversations c
    LEFT JOIN user_profiles p ON p.line_user_id = c.line_user_id
    WHERE p.line_user_id IS NULL
       OR p.display_name IS NULL
       OR p.display_name REGEXP '^U[a-f0-9]{16,}$'
  `;

  const ids = allUserIds.map((r) => r.lineUserId);
  const total = ids.length;
  if (total === 0) {
    console.log("[backfill-profiles] nothing to backfill");
    return;
  }

  console.log(`[backfill-profiles] starting — ${total} users without cached profile`);

  const BATCH = 10;
  const DELAY = 300;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (lineUserId) => {
        try {
          const profile = await client.getProfile(lineUserId);
          await prisma.userProfile.upsert({
            where: { lineUserId },
            create: { lineUserId, displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
            update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl ?? null },
          });
          done++;
        } catch {
          // User may have blocked OA or LINE ID is no longer valid — skip silently
          failed++;
        }
      })
    );
    if (i + BATCH < ids.length) {
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  console.log(`[backfill-profiles] done=${done} failed=${failed} total=${total}`);
}

/**
 * POST /api/admin/backfill-profiles
 * Trigger a manual backfill from the admin page (responds immediately,
 * runs in background). Safe to call multiple times — skips cached users.
 */
export async function backfillProfilesHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const allUserIds = await prisma.$queryRaw<Array<{ lineUserId: string }>>`
    SELECT DISTINCT c.line_user_id AS lineUserId
    FROM conversations c
    LEFT JOIN user_profiles p ON p.line_user_id = c.line_user_id
    WHERE p.line_user_id IS NULL
  `;
  const total = allUserIds.length;
  reply.send({ status: "started", total });
  runBackfillProfiles().catch(err =>
    console.error("[backfill-profiles] error:", (err as Error).message)
  );
}
