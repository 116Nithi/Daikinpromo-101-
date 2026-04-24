import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { env } from "./config/env";
import { webhookHandler } from "./webhook/handler";
import {
  adminReplyHandler,
  adminUploadHandler,
  listConversationsHandler,
  getConversationHandler,
  markConversationReadHandler,
} from "./webhook/admin-api";
import {
  exportWordHandler,
  exportPdfHandler,
} from "./webhook/admin-export";
import { ADMIN_HTML } from "./webhook/admin-page";
import { startEventProcessorWorker } from "./worker/event-processor.worker";
import { startDbWriterWorker } from "./worker/db-writer.worker";
import { prisma } from "./database/prisma";

const app = Fastify({ logger: true });

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
app.get("/api/admin/conversations", listConversationsHandler);
app.get("/api/admin/conversations/:lineUserId", getConversationHandler);
app.patch("/api/admin/conversations/:lineUserId/read", markConversationReadHandler);
app.get("/api/admin/conversations/:lineUserId/export/word", exportWordHandler);
app.get("/api/admin/conversations/:lineUserId/export/pdf", exportPdfHandler);

// Admin Chat UI
app.get("/admin", async (_, reply) => {
  reply.type("text/html").send(ADMIN_HTML);
});

async function start(): Promise<void> {
  try {
    // Connect to database
    await prisma.$connect();
    console.log("[database] Connected to PostgreSQL");

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
