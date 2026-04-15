import { Worker, Job } from "bullmq";
import { getRedisConnection, getQueue } from "./queue";
import { downloadLineContent } from "../shared/line-content";
import { uploadToGCS } from "../shared/gcs-client";
import type { WebhookJobData } from "../shared/types";

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

    // TODO v2: AI-powered reply
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
