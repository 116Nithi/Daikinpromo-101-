import { Worker, Job } from "bullmq";
import { prisma } from "../database/prisma";
import { getRedisConnection } from "./queue";

interface DbWriterJob {
  lineUserId: string;
  direction: string;
  messageType: string;
  content: unknown;
  mediaUrl?: string;
  replyToken?: string;
  sourceType?: string;
  sourceId?: string;
  timestamp: string;
  quoteToken?: string;
  quotedMessageId?: string; // serialized BigInt
  displayName?: string;     // LINE display name, inbound messages only
}

async function processDbWrite(job: Job<DbWriterJob>): Promise<void> {
  const data = job.data;

  // Outbound (admin/bot) is "read" by definition; only inbound starts unread.
  const isRead = data.direction !== "inbound";

  await prisma.conversation.create({
    data: {
      lineUserId: data.lineUserId,
      direction: data.direction,
      messageType: data.messageType,
      content: data.content as any,
      mediaUrl: data.mediaUrl,
      replyToken: data.replyToken,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      isRead,
      timestamp: new Date(data.timestamp),
      quoteToken: data.quoteToken,
      quotedMessageId: data.quotedMessageId ? BigInt(data.quotedMessageId) : undefined,
      displayName: data.displayName,
    },
  });

  console.log(
    `[db-writer] Saved ${data.direction} message from ${data.lineUserId}`
  );
}

export function startDbWriterWorker(): Worker {
  const worker = new Worker("db-writer", processDbWrite, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    console.error(`[db-writer] Job ${job?.id} failed:`, err.message);
  });

  console.log("[db-writer] Worker started");
  return worker;
}
