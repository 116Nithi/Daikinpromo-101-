import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

// Internal client — used both for direct uploads AND for the /media/* proxy
// route to fetch objects on behalf of the requester after HMAC validation.
export const s3Internal = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// `s3Public` is the SigV4-presigned-URL path: signed against the Host that the
// *browser* will request (S3_PUBLIC_ENDPOINT — e.g. https://media.example.com
// in prod). Falls back to S3_ENDPOINT when not set so internal-only setups
// still work. Only used when MEDIA_PROXY_BASE_URL is NOT set.
const s3Public = new S3Client({
  endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// Alias for backwards-compat with the upload path below.
const s3 = s3Internal;

// --- Proxy-mode helpers ---
// When MEDIA_PROXY_BASE_URL is set, getS3SignedUrl returns a URL that points
// at this app's /media/* route, signed with HMAC-SHA256(MEDIA_PROXY_SECRET).
// The route validates the HMAC and streams the object from MinIO using
// s3Internal — sidestepping SigV4 host issues when LINE must reach MinIO via
// a tunnel (ngrok / cloudflared) where MinIO isn't directly exposed.
const PROXY_ENABLED = Boolean(env.MEDIA_PROXY_BASE_URL && env.MEDIA_PROXY_SECRET);

function signProxyToken(key: string, expiresAtSec: number): string {
  // base64url HMAC over "<key>|<exp>" — ties signature to both, so token reuse
  // for a different key or after expiry is rejected.
  return createHmac("sha256", env.MEDIA_PROXY_SECRET as string)
    .update(`${key}|${expiresAtSec}`)
    .digest("base64url");
}

export function verifyProxyToken(key: string, expiresAtSec: number, token: string): boolean {
  if (!env.MEDIA_PROXY_SECRET) return false;
  if (!Number.isFinite(expiresAtSec) || Date.now() / 1000 > expiresAtSec) return false;
  const expected = signProxyToken(key, expiresAtSec);
  // Use timingSafeEqual on equal-length buffers to avoid timing-leak comparisons.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Strip path-breaking and control characters from a LINE display name and cap
// the length so it stays readable as an S3 key segment in MinIO Console.
// Returns null when nothing usable remains — the caller falls back to ID-only.
function sanitizeDisplayName(name: string | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .replace(/[/\\\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return cleaned.length > 0 ? cleaned : null;
}

// Folder shape: "{lineUserId} ({displayName})" — ID anchors uniqueness, the
// trailing parens give admins a human-readable hint when browsing the bucket.
// Falls back to bare ID when the name is missing or sanitizes to empty.
function buildUserFolder(lineUserId: string, displayName?: string): string {
  const safe = sanitizeDisplayName(displayName);
  return safe ? `${lineUserId} (${safe})` : lineUserId;
}

/**
 * Upload a buffer to MinIO/S3 and return the s3:// path (not public URL).
 * Path pattern:
 *   - With lineUserId + displayName: line-media/{lineUserId} ({displayName})/{YYYY-MM-DD}/{messageId}.{ext}
 *   - With lineUserId only:          line-media/{lineUserId}/{YYYY-MM-DD}/{messageId}.{ext}
 *   - Without (template assets, shared across chats): line-media/templates/{YYYY-MM-DD}/{messageId}.{ext}
 *
 * displayName is best-effort — when LINE getProfile fails or returns nothing,
 * we still upload but to the ID-only folder. Old objects keep their original
 * keys (DB stores the full s3:// URL verbatim) so the layout change is not
 * a breaking migration.
 */
export async function uploadToS3(
  messageId: string,
  contentType: string,
  data: Buffer,
  lineUserId?: string,
  displayName?: string
): Promise<string> {
  const ext = contentTypeToExt(contentType);
  const date = new Date().toISOString().slice(0, 10);
  const folder = lineUserId && lineUserId.length > 0
    ? buildUserFolder(lineUserId, displayName)
    : "templates";
  const destKey = `line-media/${folder}/${date}/${messageId}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: destKey,
      Body: data,
      ContentType: contentType,
    })
  );

  return `s3://${env.S3_BUCKET}/${destKey}`;
}

/**
 * Generate a presigned URL for an object.
 * Accepts either `s3://...` (new) or `gs://...` (legacy DB rows pre-migration)
 * — both are stripped to the bare key and signed against the public endpoint.
 *
 * NOTE: legacy `gs://` rows route through MinIO. The objects themselves don't
 * actually exist in MinIO yet — backfill is a separate `mc mirror` job.
 *
 * Default TTL is 7 days, matching the prior GCS behavior. The longer TTL keeps
 * admin chat windows that stay open across days from losing access to inline
 * images. AWS SDK takes seconds, so we convert from ms.
 */
export async function getS3SignedUrl(
  path: string,
  ttlMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<string> {
  if (!path || typeof path !== "string") {
    throw new Error(
      `getS3SignedUrl: path is required (got ${JSON.stringify(path)})`
    );
  }

  // Strip protocol + bucket prefix. Accept BOTH schemes during migration:
  // legacy DB rows are gs://, new uploads are s3://.
  let key = path;
  if (key.startsWith("s3://")) {
    key = key.slice("s3://".length);
  } else if (key.startsWith("gs://")) {
    key = key.slice("gs://".length);
  }
  // Drop bucket segment ("<bucket>/...") — we always sign against env.S3_BUCKET.
  const slashIdx = key.indexOf("/");
  if (slashIdx >= 0) key = key.slice(slashIdx + 1);

  if (PROXY_ENABLED) {
    // Proxy mode: return a self-hosted URL that the /media/* route will resolve.
    // Token is HMAC over "<key>|<exp>" — bound to both so we can short-circuit
    // expired or tampered URLs without a DB lookup.
    const exp = Math.floor((Date.now() + ttlMs) / 1000);
    const token = signProxyToken(key, exp);
    const base = (env.MEDIA_PROXY_BASE_URL as string).replace(/\/+$/, "");
    return `${base}/media/${env.S3_BUCKET}/${key}?token=${token}&exp=${exp}`;
  }

  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  return awsGetSignedUrl(s3Public, cmd, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
}

/**
 * Same as getS3SignedUrl but returns a host-less URL (`/media/...?...`) when
 * proxy mode is enabled. Used for media surfaced to the admin UI / browser
 * where the request stays on the same origin (avoids ngrok free's HTML
 * interstitial that breaks browser <img> loads on the public URL).
 *
 * Falls back to the public URL when proxy mode is off, since prod doesn't have
 * the interstitial issue and there's no need to differentiate.
 */
export async function getS3SignedUrlLocal(
  path: string,
  ttlMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<string> {
  if (!path || typeof path !== "string") {
    throw new Error(
      `getS3SignedUrlLocal: path is required (got ${JSON.stringify(path)})`
    );
  }

  let key = path;
  if (key.startsWith("s3://")) key = key.slice("s3://".length);
  else if (key.startsWith("gs://")) key = key.slice("gs://".length);
  const slashIdx = key.indexOf("/");
  if (slashIdx >= 0) key = key.slice(slashIdx + 1);

  if (PROXY_ENABLED) {
    const exp = Math.floor((Date.now() + ttlMs) / 1000);
    const token = signProxyToken(key, exp);
    return `/media/${env.S3_BUCKET}/${key}?token=${token}&exp=${exp}`;
  }

  // No proxy: fall back to the public presigned URL (server-side direct to S3/MinIO).
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return awsGetSignedUrl(s3Public, cmd, {
    expiresIn: Math.floor(ttlMs / 1000),
  });
}

function contentTypeToExt(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/m4a": "m4a",
    "audio/aac": "aac",
  };
  return map[contentType] ?? "bin";
}
