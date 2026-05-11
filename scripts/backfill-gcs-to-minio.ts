/**
 * One-time backfill: copy media files from the legacy GCS bucket into MinIO,
 * reorganized into the per-chat / per-day layout used by the new uploader.
 *
 * Strategy: DB-driven. We only touch files that are referenced by a row in
 * `conversations` whose `mediaUrl` starts with `gs://`. For each such row:
 *
 *   - if content.fromTemplate === true  → newKey = line-media/templates/{date}/{filename}
 *   - otherwise                          → newKey = line-media/{lineUserId}/{date}/{filename}
 *
 * Files in GCS that aren't referenced by any DB row (e.g. unsent template
 * assets that only live in admin's localStorage) are intentionally skipped —
 * a separate `mc mirror` job can sweep them later.
 *
 * Idempotent: rerunning the script skips rows whose target key already exists
 * in MinIO (just updates the DB pointer if needed). Per-row failure is logged
 * and the loop continues — one bad object doesn't abort the whole batch.
 *
 * Run via:
 *   docker compose exec app npx tsx /app/scripts/backfill-gcs-to-minio.ts --dry-run
 *   docker compose exec app npx tsx /app/scripts/backfill-gcs-to-minio.ts
 */

import { Storage } from "@google-cloud/storage";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { posix } from "node:path";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

const GCS_KEY_FILE = required("GCS_KEY_FILE");
const S3_ENDPOINT = required("S3_ENDPOINT");
const S3_REGION = process.env.S3_REGION ?? "us-east-1";
const S3_ACCESS_KEY = required("S3_ACCESS_KEY");
const S3_SECRET_KEY = required("S3_SECRET_KEY");
const S3_BUCKET = required("S3_BUCKET");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number.parseInt(LIMIT_ARG.split("=")[1], 10) : undefined;

const prisma = new PrismaClient();
const storage = new Storage({ keyFilename: GCS_KEY_FILE });
const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
});

interface ParsedGcs { bucket: string; key: string }

function parseGcsUrl(url: string): ParsedGcs | null {
  // Expected: gs://<bucket>/<key...>
  const m = url.match(/^gs:\/\/([^/]+)\/(.+)$/);
  return m ? { bucket: m[1], key: m[2] } : null;
}

function isFromTemplate(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  return (content as Record<string, unknown>).fromTemplate === true;
}

function buildNewKey(input: {
  fromTemplate: boolean;
  lineUserId: string;
  timestamp: Date;
  oldKey: string;
}): string {
  const date = input.timestamp.toISOString().slice(0, 10);
  // Keep just the filename — strip whatever date-prefix the old key carried.
  const filename = posix.basename(input.oldKey);
  const folder = input.fromTemplate ? "templates" : input.lineUserId;
  return `line-media/${folder}/${date}/${filename}`;
}

async function s3HasObject(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`[backfill] mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  console.log(`[backfill] target=${S3_ENDPOINT}/${S3_BUCKET}`);
  if (LIMIT !== undefined) console.log(`[backfill] limit=${LIMIT}`);

  const rows = await prisma.conversation.findMany({
    where: { mediaUrl: { startsWith: "gs://" } },
    orderBy: { id: "asc" },
    take: LIMIT,
  });
  console.log(`[backfill] found ${rows.length} gs:// rows to process\n`);

  let copied = 0;
  let alreadyInMinio = 0;
  let missingInGcs = 0;
  let malformed = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.mediaUrl) continue;
    const parsed = parseGcsUrl(row.mediaUrl);
    if (!parsed) {
      console.warn(`[malformed] id=${row.id} url=${row.mediaUrl}`);
      malformed++;
      continue;
    }

    const fromTemplate = isFromTemplate(row.content);
    const newKey = buildNewKey({
      fromTemplate,
      lineUserId: row.lineUserId,
      timestamp: row.timestamp,
      oldKey: parsed.key,
    });
    const newUrl = `s3://${S3_BUCKET}/${newKey}`;
    const tag = fromTemplate ? "tpl " : "user";
    const line = `[${tag}] id=${row.id} ${parsed.bucket}/${parsed.key} -> ${newKey}`;

    if (DRY_RUN) {
      console.log(line);
      continue;
    }

    try {
      // Already migrated? Just update the DB pointer if it still says gs://.
      if (await s3HasObject(newKey)) {
        await prisma.conversation.update({
          where: { id: row.id },
          data: { mediaUrl: newUrl },
        });
        console.log(`${line}  [exists, db-updated]`);
        alreadyInMinio++;
        continue;
      }

      const gcsFile = storage.bucket(parsed.bucket).file(parsed.key);
      const [exists] = await gcsFile.exists();
      if (!exists) {
        console.warn(`[missing-in-gcs] id=${row.id} ${parsed.key}`);
        missingInGcs++;
        continue;
      }

      const [meta] = await gcsFile.getMetadata();
      const contentType =
        (typeof meta.contentType === "string" ? meta.contentType : null) ??
        "application/octet-stream";
      const [buffer] = await gcsFile.download();

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: newKey,
          Body: buffer,
          ContentType: contentType,
        })
      );

      await prisma.conversation.update({
        where: { id: row.id },
        data: { mediaUrl: newUrl },
      });

      console.log(`${line}  [copied ${buffer.length}B ${contentType}]`);
      copied++;
    } catch (err) {
      console.error(`[fail] id=${row.id}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total scanned:                ${rows.length}`);
  console.log(`Copied to MinIO:              ${copied}`);
  console.log(`Already in MinIO (db updated): ${alreadyInMinio}`);
  console.log(`Missing in GCS (skipped):     ${missingInGcs}`);
  console.log(`Malformed gs:// urls:         ${malformed}`);
  console.log(`Failed:                       ${failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
