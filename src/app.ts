// Make BigInt JSON-serializable globally — Prisma returns BigInt for `id`
// columns and JSON.stringify throws on BigInt by default. This converts any
// stray BigInt to a string so Fastify's serializer can't crash on it.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (): string {
  return this.toString();
};

import Fastify from "fastify";
import fastifyCompress from "@fastify/compress";
import fastifyMultipart from "@fastify/multipart";
import { env } from "./config/env";
import { webhookHandler } from "./webhook/handler";
import {
  adminReplyHandler,
  adminUploadHandler,
  adminTemplateAssetHandler,
  adminTemplatePreviewUrlsHandler,
  adminSendTemplateHandler,
  listTemplatesHandler,
  replaceTemplatesHandler,
  listConversationsHandler,
  getConversationHandler,
  markConversationReadHandler,
  deleteConversationHandler,
  updateChatStatusHandler,
  listNoteCategoriesHandler,
  replaceNoteCategoriesHandler,
  listNotesHandler,
  upsertNoteHandler,
  deleteNoteHandler,
  getAiGlobalSettingHandler,
  setAiGlobalSettingHandler,
  getChatAiHandler,
  setChatAiHandler,
  backfillProfilesHandler,
  runBackfillProfiles,
} from "./webhook/admin-api";
import {
  exportWordHandler,
  exportPdfHandler,
  exportBulkWordHandler,
} from "./webhook/admin-export";
import { ADMIN_HTML } from "./webhook/admin-page";
import { startEventProcessorWorker } from "./worker/event-processor.worker";
import { startDbWriterWorker } from "./worker/db-writer.worker";
import { closeQueues, closeRedisConnection } from "./worker/queue";
import { prisma } from "./database/prisma";
import type { Worker } from "bullmq";

const app = Fastify({ logger: true });

app.removeContentTypeParser("application/json");
app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
  (request as typeof request & { rawBody?: string }).rawBody = body as string;
  try {
    done(null, body ? JSON.parse(body as string) : {});
  } catch (err) {
    done(err as Error);
  }
});

let eventProcessorWorker: Worker | null = null;
let dbWriterWorker: Worker | null = null;

// Surface server errors to the client so we can debug from browser console.
// Fastify's default 500 returns "Internal Server Error" with no detail.
app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
  request.log.error({ err: error, url: request.url }, "request failed");
  reply.code(error.statusCode ?? 500).send({
    error: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  });
});

// gzip/brotli compression — บีบ response อัตโนมัติถ้า > 1KB
// ลด bandwidth ของ list 700+ chat จาก ~500KB → ~80KB (≈ 6 เท่า)
// Server CPU เพิ่ม ~1-2ms ต่อ request (โอเค)
app.register(fastifyCompress, {
  global: true,
  threshold: 1024, // skip ของเล็ก ๆ (overhead ไม่คุ้ม)
  encodings: ["br", "gzip", "deflate"],
});

app.register(fastifyMultipart, {
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB (LINE video cap); per-type limits enforced in handler
});

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// LINE Webhook endpoint
app.post("/webhook", webhookHandler);
app.post("/line/webhook", webhookHandler);

// Admin API
app.post("/api/admin/reply", adminReplyHandler);
app.post("/api/admin/upload", adminUploadHandler);
app.post("/api/admin/template-asset", adminTemplateAssetHandler);
app.post("/api/admin/template-preview-urls", adminTemplatePreviewUrlsHandler);
app.post("/api/admin/send-template", adminSendTemplateHandler);
app.get("/api/admin/templates", listTemplatesHandler);
app.put("/api/admin/templates", replaceTemplatesHandler);
app.get("/api/admin/conversations", listConversationsHandler);
app.get("/api/admin/conversations/:lineUserId", getConversationHandler);
app.patch("/api/admin/conversations/:lineUserId/read", markConversationReadHandler);
app.delete("/api/admin/conversations/:lineUserId", deleteConversationHandler);
app.patch("/api/admin/chat-status/:lineUserId", updateChatStatusHandler);
app.get("/api/admin/note-categories", listNoteCategoriesHandler);
app.put("/api/admin/note-categories", replaceNoteCategoriesHandler);
app.get("/api/admin/notes", listNotesHandler);
app.post("/api/admin/notes", upsertNoteHandler);
app.delete("/api/admin/notes/:id", deleteNoteHandler);
app.post("/api/admin/conversations/:lineUserId/export/word", exportWordHandler);
app.post("/api/admin/conversations/:lineUserId/export/pdf", exportPdfHandler);
app.post("/api/admin/export/bulk/word", exportBulkWordHandler);
app.get("/api/admin/settings/ai-global", getAiGlobalSettingHandler);
app.post("/api/admin/settings/ai-global", setAiGlobalSettingHandler);
app.get("/api/admin/conversations/:lineUserId/ai-enabled", getChatAiHandler);
app.post("/api/admin/conversations/:lineUserId/ai-enabled", setChatAiHandler);
app.post("/api/admin/backfill-profiles", backfillProfilesHandler);

// Admin Chat UI
app.get("/admin", async (_, reply) => {
  reply.type("text/html").send(ADMIN_HTML);
});

async function start(): Promise<void> {
  try {
    // Connect to database
    await prisma.$connect();
    console.log("[database] Connected to MySQL");

    // Start workers
    eventProcessorWorker = startEventProcessorWorker();
    dbWriterWorker = startDbWriterWorker();

    // Start HTTP server
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`[server] Running on port ${env.PORT}`);

    // Auto-backfill LINE profiles for existing users that have no cached name.
    // Runs in background — server is already accepting requests before this finishes.
    runBackfillProfiles().catch(err =>
      console.error("[backfill-profiles] startup error:", (err as Error).message)
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log("[server] Shutting down...");
  await app.close();
  await Promise.all([
    eventProcessorWorker?.close(),
    dbWriterWorker?.close(),
  ]);
  await closeQueues();
  await closeRedisConnection();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
