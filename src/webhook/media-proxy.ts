import { FastifyRequest, FastifyReply } from "fastify";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Internal, verifyProxyToken } from "../shared/s3-client";
import { env } from "../config/env";

interface MediaProxyParams { bucket: string; "*": string }
interface MediaProxyQuery { token?: string; exp?: string }

/**
 * GET /media/:bucket/*?token=<hmac>&exp=<unix>
 *
 * HMAC-validated reverse proxy that streams objects from MinIO using internal
 * credentials. Used in dev / on-prem setups where MinIO isn't itself reachable
 * from LINE (e.g. behind a single ngrok tunnel pointed at the app).
 *
 * The token is HMAC-SHA256(MEDIA_PROXY_SECRET, "<key>|<exp>") — bound to both
 * the key and expiry, so we can reject without a DB roundtrip.
 *
 * Bucket is enforced to match S3_BUCKET to avoid path traversal into other
 * buckets even if the URL is crafted by hand.
 */
export async function mediaProxyHandler(
  request: FastifyRequest<{ Params: MediaProxyParams; Querystring: MediaProxyQuery }>,
  reply: FastifyReply
): Promise<void> {
  const bucket = request.params.bucket;
  const key = request.params["*"];
  const token = request.query.token ?? "";
  const expRaw = request.query.exp ?? "";

  if (bucket !== env.S3_BUCKET) {
    reply.code(404).send({ error: "not found" });
    return;
  }
  if (!key || !token || !expRaw) {
    reply.code(400).send({ error: "missing token / exp" });
    return;
  }

  const exp = Number.parseInt(expRaw, 10);
  if (!verifyProxyToken(key, exp, token)) {
    reply.code(403).send({ error: "invalid or expired token" });
    return;
  }

  try {
    const obj = await s3Internal.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    // Buffer the whole body before responding. The SDK wraps the body in a
    // ChecksumStream that can emit data after end() — pumping it through
    // reply.send() triggers ERR_STREAM_WRITE_AFTER_END on Fastify, which left
    // LINE seeing a truncated body (broken thumbnail). Buffering avoids this.
    // Memory cost is bounded: upload-side already caps files at 200MB.
    const body = obj.Body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (!body || typeof body.transformToByteArray !== "function") {
      reply.code(500).send({ error: "unsupported body type" });
      return;
    }
    const bytes = await body.transformToByteArray();
    const buf = Buffer.from(bytes);

    if (obj.ContentType) reply.header("Content-Type", obj.ContentType);
    // Cache aggressively in browser/CDN — token expiry already constrains lifetime.
    reply.header("Cache-Control", "private, max-age=3600");
    reply.send(buf);
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
      reply.code(404).send({ error: "not found" });
      return;
    }
    request.log.error({ err, bucket, key }, "media proxy fetch failed");
    reply.code(502).send({ error: "upstream fetch failed" });
  }
}
