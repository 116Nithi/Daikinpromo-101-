// Make BigInt JSON-serializable globally — Prisma returns BigInt for `id`
// columns and JSON.stringify throws on BigInt by default. This converts any
// stray BigInt to a string so Fastify's serializer can't crash on it.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (): string {
  return this.toString();
};

import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { env } from "./config/env";
import { webhookHandler } from "./webhook/handler";
import {
  adminReplyHandler,
  adminUploadHandler,
  adminTemplateAssetHandler,
  adminTemplatePreviewUrlsHandler,
  adminSendTemplateHandler,
  listConversationsHandler,
  getConversationHandler,
  markConversationReadHandler,
  deleteConversationHandler,
  updateChatStatusHandler,
} from "./webhook/admin-api";
import {
  exportWordHandler,
  exportPdfHandler,
  exportBulkWordHandler,
} from "./webhook/admin-export";
import { ADMIN_HTML } from "./webhook/admin-page";
import { startEventProcessorWorker } from "./worker/event-processor.worker";
import { startDbWriterWorker } from "./worker/db-writer.worker";
import { prisma } from "./database/prisma";

const app = Fastify({ logger: true });

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

app.register(fastifyMultipart, {
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB (LINE video cap); per-type limits enforced in handler
});

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// LINE Webhook endpoint
app.post("/webhook", webhookHandler);

// Admin API
app.post("/api/admin/reply", adminReplyHandler);
app.post("/api/admin/upload", adminUploadHandler);
app.post("/api/admin/template-asset", adminTemplateAssetHandler);
app.post("/api/admin/template-preview-urls", adminTemplatePreviewUrlsHandler);
app.post("/api/admin/send-template", adminSendTemplateHandler);
app.get("/api/admin/conversations", listConversationsHandler);
app.get("/api/admin/conversations/:lineUserId", getConversationHandler);
app.patch("/api/admin/conversations/:lineUserId/read", markConversationReadHandler);
app.delete("/api/admin/conversations/:lineUserId", deleteConversationHandler);
app.patch("/api/admin/chat-status/:lineUserId", updateChatStatusHandler);
app.post("/api/admin/conversations/:lineUserId/export/word", exportWordHandler);
app.post("/api/admin/conversations/:lineUserId/export/pdf", exportPdfHandler);
app.post("/api/admin/export/bulk/word", exportBulkWordHandler);

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
    startEventProcessorWorker();
    startDbWriterWorker();

    // Start HTTP server
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`[server] Running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log("[server] Shutting down...");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
