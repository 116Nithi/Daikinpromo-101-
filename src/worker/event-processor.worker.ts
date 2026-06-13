// src/worker/event-processor.worker.ts
import { Worker, Job } from "bullmq";
import { messagingApi } from "@line/bot-sdk";
import { getRedisConnection, getQueue } from "./queue";
import { downloadLineContent } from "../shared/line-content";
import { uploadToGCS } from "../shared/gcs-client";
import { askAI } from "../shared/ai-reply";
import { isAiEnabled, isUserAiEnabled } from "../shared/ai-settings";
import { prisma } from "../database/prisma";
import type { WebhookJobData } from "../shared/types";

// Keywords the AI uses when it decides a case needs a human admin.
// When found in the AI reply, needsAdmin is set to true in chat_status so the
// conversation floats up with a bell icon in the admin panel.
const NEEDS_ADMIN_KEYWORDS = [
  "ติดต่อเจ้าหน้าที่", "โอนสาย", "เจ้าหน้าที่จะติดต่อ",
  "แอดมินจะ", "ส่งเรื่อง", "ขอให้แอดมิน", "รอเจ้าหน้าที่",
];
function detectNeedsAdmin(text: string): boolean {
  return NEEDS_ADMIN_KEYWORDS.some(kw => text.includes(kw));
}

// Used to fetch sender profile so media uploads land in a folder named after
// the user (see uploadToS3 for the path shape). Failures here are non-fatal —
// upload still proceeds with ID-only folder.
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
});

const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);

async function processEvent(job: Job<WebhookJobData>): Promise<void> {
  const { events } = job.data;
  const redis = getRedisConnection();

  for (const event of events) {
    const lineUserId =
      event.source.userId ??
      event.source.groupId ??
      event.source.roomId ??
      "unknown";

    if (!event.message) continue;

    // Dedup: ป้องกัน LINE webhook retry / double-route
    const msgId = (event.message as unknown as Record<string, unknown>).id as string | undefined;
    if (msgId) {
      const set = await redis.set(`dedup:msg:${msgId}`, "1", "EX", 86400, "NX");
      if (!set) {
        console.log(`[event-processor] Skipping duplicate message ${msgId}`);
        continue;
      }
    }

    let mediaUrl: string | undefined;

    // Cache LINE profile (name + avatar) on every inbound user message so the
    // admin conversation list can read from DB instead of calling getProfile
    // for every user on every page load (which causes rate-limit failures at scale).
    let cachedDisplayName: string | undefined;
    if (event.source.type === "user" && event.source.userId) {
      try {
        const profile = await lineClient.getProfile(event.source.userId);
        cachedDisplayName = profile.displayName;
        await prisma.userProfile.upsert({
          where: { lineUserId: event.source.userId },
          create: {
            lineUserId: event.source.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl ?? null,
          },
          update: {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl ?? null,
          },
        });
      } catch (err) {
        console.warn(`[event-processor] getProfile failed for ${event.source.userId}: ${(err as Error).message}`);
      }
    }

    // Download media and upload to GCS
    if (MEDIA_TYPES.has(event.message.type) && event.message.id) {
      try {
        const { buffer, contentType } = await downloadLineContent(
          event.message.id as string
        );

        mediaUrl = await uploadToGCS(
          event.message.id as string,
          contentType,
          buffer,
          lineUserId,
          cachedDisplayName  // reuse profile already fetched above
        );
        console.log(
          `[event-processor] Uploaded ${event.message.type} -> ${mediaUrl}`
        );
      } catch (err) {
        console.error(
          `[event-processor] Failed to upload media ${event.message.id}:`,
          (err as Error).message
        );
      }
    }

    // Log to DB. Capture LINE's quoteToken so admin can reply-quote this
    // message later (token typically valid ~14 days per LINE docs).
    const rawQuote = (event.message as unknown as Record<string, unknown>).quoteToken;
    const quoteToken = typeof rawQuote === "string" ? rawQuote : undefined;

    const dbQueue = getQueue("db-writer");
    await dbQueue.add("log-inbound", {
      lineUserId,
      direction: "inbound",
      messageType: event.message.type,
      content: event.message,
      mediaUrl,
      replyToken: event.replyToken,
      sourceType: event.source.type,
      sourceId: lineUserId,
      timestamp: new Date(event.timestamp).toISOString(),
      quoteToken,
      displayName: cachedDisplayName,
    });

    // ============================================================
    // [AI DISABLED] ปิด AI auto-reply ทั้งหมด
    // เดิม if-condition ถูก comment ไว้ แต่ body try/catch ยังรันอยู่
    // ทำให้ AI ตอบทุกข้อความโดยไม่สนใจ toggle — บั๊กจริง
    // ถ้าจะเปิด AI กลับคืน: uncomment block ด้านล่างทั้งหมด แล้วใส่
    // เงื่อนไข isAiEnabled() && isUserAiEnabled(lineUserId) ครอบ
    // ============================================================
    // if (
    //   isAiEnabled() &&
    //   isUserAiEnabled(lineUserId) &&
    //   event.message.type === "text" &&
    //   event.message.text &&
    //   event.replyToken
    // ) {
    //   try {
    //     const aiReply = await askAI(lineUserId, event.message.text ?? "");
    //     await lineClient.replyMessage({
    //       replyToken: event.replyToken ?? "",
    //       messages: [{ type: "text", text: aiReply }],
    //     });
    //     if (detectNeedsAdmin(aiReply)) {
    //       await (prisma.chatStatus.upsert as (a: unknown) => Promise<unknown>)({
    //         where: { lineUserId },
    //         create: { lineUserId, needsAdmin: true },
    //         update: { needsAdmin: true },
    //       });
    //       console.log(`[event-processor] needsAdmin set for ${lineUserId}`);
    //     }
    //     console.log(`[event-processor] AI replied to ${lineUserId}`);
    //   } catch (err) {
    //     console.error(`[event-processor] Failed to send AI reply:`, (err as Error).message);
    //   }
    // }
  }
}

// Starts the BullMQ worker that processes LINE webhook events from the queue.
// concurrency: 5 means up to 5 events run in parallel — safe because each event
// is scoped to one lineUserId and the DB log uses a queue (no direct write race).
export function startEventProcessorWorker(): Worker {
  const worker = new Worker("webhook-events", processEvent, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[event-processor] Job ${job?.id} failed:`, err.message);
  });

  console.log("[event-processor] Worker started");
  return worker;
}
