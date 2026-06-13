import { FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { env } from "../config/env";
import { getQueue } from "../worker/queue";
import type { LineWebhookEvent } from "../shared/types";

interface WebhookBody {
  events: LineWebhookEvent[];
  destination: string;
}

interface RawBodyRequest extends FastifyRequest {
  rawBody?: string;
}

/**
 * Verify LINE webhook signature using HMAC-SHA256.
 */
function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  const expected = Buffer.from(hash);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(
    expected,
    actual
  );
}

export async function webhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers["x-line-signature"] as string;
  const rawRequest = request as RawBodyRequest;

  if (!signature) {
    reply.code(400).send({ error: "Missing signature" });
    return;
  }

  // Fastify raw body for signature verification
  const rawBody = rawRequest.rawBody ?? (
    typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body)
  );

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
