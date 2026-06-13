import { Storage } from "@google-cloud/storage";
import { env } from "../config/env";

// GCS_KEY_FILE may be:
//   - undefined → use Application Default Credentials (Workload Identity on GKE)
//   - a file path (local dev) → use as keyFilename
//   - a JSON string (K8s secret stringData) → parse and use as credentials
const keyFileValue = env.GCS_KEY_FILE?.trim();
const storage = new Storage(
  !keyFileValue
    ? {}
    : keyFileValue.startsWith("{")
      ? { credentials: JSON.parse(keyFileValue) }
      : { keyFilename: keyFileValue }
);

const bucket = storage.bucket(env.GCS_BUCKET_NAME);

// Strip path-breaking and control characters from a LINE display name and cap
// the length so it stays readable as a key segment in GCS console listings.
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
 * Upload a buffer to GCS and return the gs:// path (not public URL).
 * Path pattern:
 *   - With lineUserId + displayName: line-media/{lineUserId} ({displayName})/{YYYY-MM-DD}/{messageId}.{ext}
 *   - With lineUserId only:          line-media/{lineUserId}/{YYYY-MM-DD}/{messageId}.{ext}
 *   - Without (template assets, shared across chats): line-media/templates/{YYYY-MM-DD}/{messageId}.{ext}
 *
 * displayName is best-effort — when LINE getProfile fails or returns nothing,
 * we still upload but to the ID-only folder.
 */
export async function uploadToGCS(
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
  const destPath = `line-media/${folder}/${date}/${messageId}.${ext}`;

  const file = bucket.file(destPath);
  await file.save(data, { contentType, resumable: false });
  return `gs://${env.GCS_BUCKET_NAME}/${destPath}`;
}

/**
 * Generate a signed URL for a GCS path.
 * Default TTL is 7 days (GCS V4 max) — long enough that admin chat windows
 * left open across days don't lose access to inline images.
 */
export async function getSignedUrl(
  gcsPath: string,
  ttlMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<string> {
  if (!gcsPath || typeof gcsPath !== "string") {
    throw new Error(`getSignedUrl: gcsPath is required (got ${JSON.stringify(gcsPath)})`);
  }
  // Strip protocol + bucket prefix. Tolerate both gs:// (current) and s3://
  // (legacy rows from the brief MinIO experiment) so admin chat history stays
  // viewable even before the DB migration runs.
  let key = gcsPath;
  if (key.startsWith("gs://") || key.startsWith("s3://")) {
    key = key.slice(5);
    const slashIdx = key.indexOf("/");
    if (slashIdx >= 0) key = key.slice(slashIdx + 1);
  }
  const file = bucket.file(key);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + ttlMs,
  });

  return url;
}

// GCS doesn't need the public/local URL distinction the MinIO proxy required —
// signed URLs are direct and SigV4 host issues don't apply. Re-export so the
// callers that grew this dependency during the MinIO experiment keep working
// without touching their import lines further.
export const getSignedUrlLocal = getSignedUrl;

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
