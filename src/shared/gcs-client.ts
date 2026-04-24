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

/**
 * Upload a buffer to GCS and return the GCS path (not public URL).
 * Path pattern: line-media/{YYYY-MM-DD}/{messageId}.{ext}
 */
export async function uploadToGCS(
  messageId: string,
  contentType: string,
  data: Buffer
): Promise<string> {
  const ext = contentTypeToExt(contentType);
  const date = new Date().toISOString().slice(0, 10);
  const destPath = `line-media/${date}/${messageId}.${ext}`;

  const file = bucket.file(destPath);
  await file.save(data, { contentType, resumable: false });

  // Store GCS path, generate signed URL on demand
  return `gs://${env.GCS_BUCKET_NAME}/${destPath}`;
}

/**
 * Generate a signed URL for a GCS path.
 */
export async function getSignedUrl(
  gcsPath: string,
  ttlMs: number = 60 * 60 * 1000
): Promise<string> {
  // gcsPath format: gs://bucket-name/path/to/file
  const path = gcsPath.replace(`gs://${env.GCS_BUCKET_NAME}/`, "");
  const file = bucket.file(path);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + ttlMs,
  });

  return url;
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
