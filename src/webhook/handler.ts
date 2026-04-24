import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { env } from "../config/env";
import { getQueue } from "../worker/queue";
import type { LineWebhookEvent } from "../shared/types";

interface WebhookBody {
  events: LineWebhookEvent[];
  destination: string;
}

/**
 * Verify LINE webhook signature using HMAC-SHA256.
 */
function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}

export async function webhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers["x-line-signature"] as string;

  if (!signature) {
    reply.code(400).send({ error: "Missing signature" });
    return;
  }

  // Fastify raw body for signature verification
  const rawBody =
    typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body);

  // ข้าม signature check ตอน development
  if (env.NODE_ENV !== "development" && !verifySignature(rawBody, signature)) {
    reply.code(401).send({ error: "Invalid signature" });
    return;
  }

  const body = (
    typeof request.body === "string"
      ? JSON.parse(request.body)
      : request.body
  ) as WebhookBody;

  // Return 200 immediately, process async via queue
  if (body.events.length > 0) {
    const queue = getQueue("webhook-events");
    await queue.add("process-events", {
      events: body.events,
      receivedAt: new Date().toISOString(),
    });
  }

  reply.code(200).send({ status: "ok" });
}