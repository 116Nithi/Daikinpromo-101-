# `legacy/pre-minio/` — Snapshot for GCS rollback

This folder is a frozen copy of the files that were rewritten when object
storage was migrated from **Google Cloud Storage** to **MinIO**
(S3-compatible, on-prem, deployed on Rancher k8s with Backblaze B2 as the
future cold-backup target).

These files are **uncommented, full original content** — drop-in replacements.
The corresponding files in the live tree have their old code wrapped in
`/* ... */` (or `# ...` for YAML/env) so the migration is reversible without
hunting through git history.

## What's in this folder

| File                                | Why it's here                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/env.ts`                 | The `GCS_BUCKET_NAME` / `GCS_KEY_FILE` zod schema entries. Replaced by `S3_*` entries in the live tree.                                       |
| `src/shared/gcs-client.ts`          | The `Storage` SDK init, `uploadToGCS()`, `getSignedUrl()`. Live tree's copy has the entire body wrapped in `/* */` and ends with `export {};`. |
| `docker-compose.yml`                | Original compose file — no `minio` / `minio-init` services, GCS service-account JSON volume mount intact.                                    |
| `.env.example`                      | Original env template with the GCS section uncommented and no S3 section.                                                                     |

The 3 consumer files (`src/worker/event-processor.worker.ts`,
`src/webhook/admin-api.ts`, `src/webhook/admin-export.ts`) only had their
**import line** changed. They are **not** snapshotted here — the rollback for
those files is to revert one line each (see step 3 below).

## Rollback steps

If MinIO needs to be ripped back out and GCS restored:

1. **Restore env / config / GCS client.** From the project root:

   ```sh
   cp legacy/pre-minio/src/config/env.ts          src/config/env.ts
   cp legacy/pre-minio/src/shared/gcs-client.ts   src/shared/gcs-client.ts
   cp legacy/pre-minio/docker-compose.yml         docker-compose.yml
   cp legacy/pre-minio/.env.example               .env.example
   ```

2. **Restore the 3 consumer imports** — change each `s3-client` line back to the
   GCS line (the GCS line is left commented just above it):

   - `src/worker/event-processor.worker.ts`
     ```ts
     import { uploadToGCS } from "../shared/gcs-client";
     ```
   - `src/webhook/admin-api.ts`
     ```ts
     import { getSignedUrl, uploadToGCS } from "../shared/gcs-client";
     ```
   - `src/webhook/admin-export.ts`
     ```ts
     import { getSignedUrl } from "../shared/gcs-client";
     ```

3. **(Optional) Drop the AWS SDK packages.** They aren't doing harm, but if you
   want a clean rollback:

   ```sh
   npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

4. **(Optional) Drop the `s3://` branch in prefix checks.** During the
   migration, three spots were widened from `startsWith("gs://")` to
   `startsWith("gs://") || startsWith("s3://")`:
   - `src/webhook/admin-api.ts` (`adminTemplatePreviewUrlsHandler`,
     `getConversationHandler`)
   - `src/webhook/admin-export.ts` (`buildExportBundle`)

   If you've already migrated all rows away from `s3://` paths you can
   collapse them back to `gs://` only — but it's safe to leave them.

5. **Restore your `.env`.** Set `GCS_BUCKET_NAME` and `GCS_KEY_FILE` again and
   remove the `S3_*` block.

6. **`docker compose up -d --build`** — should boot exactly as before.

## ⚠️ Caveat: file location after rollback

Files **uploaded after the migration date** physically live in MinIO, not GCS.
A rollback that swaps the code does **not** copy those files back to GCS — any
DB rows whose `mediaUrl` is `s3://kongkwun-media/...` will 404 once the
GCS-only code path is restored, because GCS doesn't have those objects.

If you need a true round-trip rollback, run an `mc mirror local/kongkwun-media
gcs://<bucket>` (or the `gsutil rsync` equivalent) **before** flipping the code
back, then translate the `s3://` rows in the DB to `gs://` rows.

## What is NOT in scope here

- The forward-direction backfill (`gs://` → MinIO) is a separate `mc mirror`
  job. The migration code accepts `gs://` paths and routes them through MinIO,
  but the objects themselves haven't been copied yet.
- The `k8s/` manifests were intentionally **not** touched in this round.
  They're still GCS-shaped. A separate task will produce MinIO + B2 manifests
  for Rancher.
