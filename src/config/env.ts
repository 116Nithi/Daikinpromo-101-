import { z } from "zod";

const envSchema = z.object({
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // --- LEGACY GCS (kept commented for rollback — see legacy/pre-minio/README.md) ---
  // GCS_BUCKET_NAME: z.string().min(1),
  // GCS_KEY_FILE: z.string().optional(), // path to service account JSON (local dev)

  // --- S3 / MinIO ---
  // S3_ENDPOINT is the host the *app* uses to reach object storage (e.g.
  // http://minio:9000 inside docker/k8s). S3_PUBLIC_ENDPOINT is the host the
  // *browser* uses for presigned URLs (e.g. http://localhost:9000 in dev).
  // SigV4 signs the Host header, so the URL host must match what the browser
  // requests — see src/shared/s3-client.ts for why two clients exist.
  S3_ENDPOINT: z.string().min(1),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),

  // --- Media proxy (dev / on-prem without HTTPS-public MinIO) ---
  // When MEDIA_PROXY_BASE_URL is set, getS3SignedUrl returns
  //   {MEDIA_PROXY_BASE_URL}/media/{bucket}/{key}?token=<hmac>&exp=<unix>
  // instead of an S3 SigV4 presigned URL. The /media/* route in the app
  // verifies the HMAC and streams the object from MinIO using internal creds.
  // This sidesteps SigV4 host-mismatch when LINE must fetch through a tunnel
  // (ngrok / cloudflared) where MinIO isn't directly exposed.
  // Leave both unset in production where MinIO has its own HTTPS public host.
  MEDIA_PROXY_BASE_URL: z.string().optional(),
  MEDIA_PROXY_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
