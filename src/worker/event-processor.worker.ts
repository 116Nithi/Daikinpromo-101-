// src/worker/event-processor.worker.ts
import { Worker, Job } from "bullmq";
import { getRedisConnection, getQueue } from "./queue";
import { downloadLineContent } from "../shared/line-content";
import { uploadToGCS } from "../shared/gcs-client";
//import { askAI } from "../shared/ai-reply"; // ✅ เพิ่ม import ai-reply
import type { WebhookJobData } from "../shared/types";

// LINE client สำหรับ reply
import { messagingApi } from "@line/bot-sdk";
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
});

const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);

async function processEvent(job: Job<WebhookJobData>): Promise<void> {
  const { events } = job.data;

  for (const event of events) {
    const lineUserId =
      event.source.userId ??
      event.source.groupId ??
      event.source.roomId ??
      "unknown";

    if (!event.message) continue;

    let mediaUrl: string | undefined;

    // Download media and upload to GCS
    if (MEDIA_TYPES.has(event.message.type) && event.message.id) {
      try {
        const { buffer, contentType } = await downloadLineContent(
          event.message.id as string
        );
        mediaUrl = await uploadToGCS(
          event.message.id as string,
          contentType,
          buffer
        );
        console.log(
          `[event-processor] Uploaded ${event.message.type} → ${mediaUrl}`
        );
      } catch (err) {
        console.error(
          `[event-processor] Failed to upload media ${event.message.id}:`,
          (err as Error).message
        );
      }
    }

    // Log to DB
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
    });

    // ✅ v2: AI-powered reply (เฉพาะข้อความ text เท่านั้น)
    // if (
    //   event.message.type === "text" &&
    //   event.message.text &&
    //   event.replyToken
    // ) {
      // try {
      //   const aiReply = await askAI(lineUserId, event.message.text);

      //   await lineClient.replyMessage({
      //     replyToken: event.replyToken,
      //     messages: [{ type: "text", text: aiReply }],
      //   });

      //   // ✅ Log outbound AI reply ลง DB ด้วย
      //   await dbQueue.add("log-inbound", {
      //     lineUserId,
      //     direction: "outbound_bot",
      //     messageType: "text",
      //     content: { text: aiReply },
      //     sourceType: event.source.type,
      //     sourceId: lineUserId,
      //     timestamp: new Date().toISOString(),
      //   });

      //   console.log(`[event-processor] AI replied to ${lineUserId}`);
      // } catch (err) {
      //   console.error(
      //     `[event-processor] Failed to send AI reply:`,
      //     (err as Error).message
      //   );
      // }
    //}
  }
}

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