# Daikinpromo Chat — Developer Guide

---

## ข้อมูลเอกสาร (Document Information)

| รายการ | รายละเอียด |
|---|---|
| **ชื่อเอกสาร** | Daikinpromo Chat — Developer Handover Guide |
| **ชื่อภายใน (internal)** | KongKwun Bot — namespace/image tag ยังใช้ชื่อนี้ |
| **เวอร์ชัน** | 1.2 |
| **วันที่จัดทำ** | 2026-06-09 |
| **วันที่แก้ไขล่าสุด** | 2026-06-10 |
| **ผู้จัดทำ** | ทีม SMMMS (team@smmms.com) |
| **ผู้อนุมัติ** | _รอระบุ_ |
| **สถานะ** | Active |
| **รอบทบทวนถัดไป** | 2026-09-09 (ทุก 3 เดือน หรือเมื่อมีการเปลี่ยน stack) |
| **Image ล่าสุด** | `smartcms/kongkwun-chat:v5` (Docker Hub) — prod ยังรัน `:v2` |

---

## 1. วัตถุประสงค์และกลุ่มเป้าหมาย (Purpose & Audience)

### 1.1 วัตถุประสงค์
เพื่อให้ DEV ที่เข้ามารับช่วงต่อสามารถ **เริ่มงานได้ภายใน 1 วัน** โดยเข้าใจ:
- ภาพรวมระบบและสถาปัตยกรรม
- วิธี setup environment สำหรับ development
- จุดที่เคยมีปัญหา (Gotchas) และวิธีหลีกเลี่ยง
- วิธี deploy ขึ้น production

### 1.2 กลุ่มเป้าหมาย
- **หลัก:** Full-stack Developer ที่จะรับงานต่อ (มีพื้น Node.js + TypeScript)
- **รอง:** DevOps / SRE ที่ดูแล deployment, PM ที่ต้องการเข้าใจระบบในระดับสูง

### 1.3 ขอบเขต (Scope)
ครอบคลุม backend (Fastify + Prisma + BullMQ), frontend (Vue 3), database schema, deployment (Docker + K8s), และ known issues
**ไม่ครอบคลุม:** business logic ฝั่ง LINE OA, การตั้งค่า LINE Developers Console, รายละเอียดสัญญากับลูกค้า

---

## 2. สรุปย่อสำหรับผู้บริหาร (Executive Summary)

**Daikinpromo Chat** (ชื่อภายใน: KongKwun Bot) คือระบบ LINE Official Account Webhook + Conversation Logger + Admin Chat UI ที่:
- รับและบันทึกบทสนทนา LINE ทั้งหมดลง MySQL
- มี Admin UI ให้เจ้าหน้าที่ตอบแชต / ส่ง template / export Word + PDF
- 🚫 **AI auto-reply ปิดอยู่ทั้งหมด** ตั้งแต่ v1.1 — แอดมินตอบเองทั้งหมด
- เก็บ media ทั้งหมดบน Google Cloud Storage (GCS)
- ฟีเจอร์ **custom display name** สำหรับลูกค้าที่ใช้ชื่อ LINE แปลก ๆ

**Stack หลัก:** Node.js 20 + Fastify 5 + TypeScript + Prisma (MySQL) + BullMQ (Redis) + Vue 3
**Deployment:** Docker image → Kubernetes (2 replicas, HPA enabled)
**Image ปัจจุบันบน registry:** `smartcms/kongkwun-chat:v5` — **prod ยังรัน `:v2`** (ต้อง deploy)

**สิ่งที่ DEV ใหม่ต้องโฟกัสก่อน** (อ่านส่วน 🔴):
1. โครงสร้างโปรเจกต์และ flow ของระบบ (ส่วน 4, 7)
2. Gotchas สำคัญ 15 ข้อ — โดยเฉพาะ 8.11 (AI off), 8.12 (custom name), 8.13 (tab ใหม่)
3. Notification algorithm (ส่วน 9.2) + display name resolution (ส่วน 9.3)
4. Deployment + pre-deploy checklist (ส่วน 12)

**งานที่ยังค้าง** (ดูส่วน 13):
- Custom name → DB migration (sync ข้าม browser)
- Auth ที่ admin API (สำคัญสุด)
- Pagination/virtual scroll (เมื่อ scale)
- AI re-enable plan (เมื่อพร้อม)
- Unify Admin UI สองตัว, test suite, secret manager, rate-limit

---

## 3. สารบัญ

> 🔴 **(หลัก)** = ส่วนสำคัญ ต้องอ่าน/เข้าใจก่อนแตะโค้ด
> ⚪ ส่วนอื่นเป็น reference อ่านตอนต้องใช้ได้

1. [วัตถุประสงค์และกลุ่มเป้าหมาย](#1-วัตถุประสงค์และกลุ่มเป้าหมาย-purpose--audience)
2. [สรุปย่อสำหรับผู้บริหาร](#2-สรุปย่อสำหรับผู้บริหาร-executive-summary)
3. [สารบัญ](#3-สารบัญ)
4. [ภาพรวมโปรเจกต์](#4-ภาพรวมโปรเจกต์)
5. [Tech Stack](#5-tech-stack)
6. [โครงสร้างโปรเจกต์](#6-โครงสร้างโปรเจกต์) **(หลัก)**
7. [ตั้งค่าเครื่อง Dev ครั้งแรก](#7-ตั้งค่าเครื่อง-dev-ครั้งแรก) **(หลัก)**
8. [สิ่งที่ต้องระวัง / Gotchas](#8-สิ่งที่ต้องระวัง--gotchas) **(หลัก)**
   - 8.1 [BigInt serialization](#81-bigint-serialization) **(หลัก)**
   - 8.2 [LINE webhook signature](#82-line-webhook-signature) **(หลัก)**
   - 8.3 [LINE quote token field](#83-line-quote-token-field)
   - 8.4 [Dedup ป้องกัน webhook retry](#84-dedup-ป้องกัน-webhook-retry) **(หลัก)**
   - 8.5 [Profile cache](#85-profile-cache) **(หลัก)**
   - 8.6 [needsAdmin detection](#86-needsadmin-detection)
   - 8.7 [GCS service account](#87-gcs-service-account) **(หลัก)**
   - 8.8 [Thai font for PDF](#88-thai-font-for-pdf)
   - 8.9 [Error handler](#89-error-handler)
   - 8.10 [Multipart limit](#810-multipart-limit)
   - 8.11 [AI ปิดสนิทตั้งแต่ v1.1](#811-ai-ปิดสนิทตั้งแต่-v11) **(หลัก)**
   - 8.12 [Custom display name (localStorage)](#812-custom-display-name-localstorage) **(หลัก)**
   - 8.13 [ตรรกะ tab "ยังไม่ตอบ" v1.1](#813-ตรรกะ-tab-ยังไม่ตอบ-v11) **(หลัก)**
   - 8.14 [Performance optimizations v1.1](#814-performance-optimizations-v11)
   - 8.15 [Note body เป็น optional](#815-note-body-เป็น-optional)
9. [Architecture — flow ที่ต้องเข้าใจ](#9-architecture--flow-ที่ต้องเข้าใจ) **(หลัก)**
   - 9.1 [Webhook → DB flow](#91-webhook--db-flow)
   - 9.2 [Notification algorithm](#92-notification-algorithm-3-สัญญาณอิสระ) **(หลัก)**
   - 9.3 [Display name resolution](#93-display-name-resolution) **(หลัก)**
   - 9.4 [Polling (visibility-aware)](#94-polling-visibility-aware)
10. [Database](#10-database) **(หลัก)**
11. [API endpoints](#11-api-endpoints)
12. [Build + Deploy](#12-build--deploy) **(หลัก)**
13. [งานค้างที่ควรเก็บ / ปรับปรุง](#13-งานค้างที่ควรเก็บ--ปรับปรุง)
14. [ติดต่อ / Reference](#14-ติดต่อ--reference)
15. [ประวัติการแก้ไขเอกสาร](#15-ประวัติการแก้ไขเอกสาร-revision-history)

---

## 4. ภาพรวมโปรเจกต์

LINE Official Account Webhook + Conversation Logger + Admin Chat UI
- รับ webhook จาก LINE → log การสนทนาเก็บใน MySQL
- มี Admin UI สำหรับเจ้าหน้าที่ตอบแชต / ส่ง template / export Word + PDF
- 🚫 **AI auto-reply ปิดอยู่ทั้งระบบ** ตั้งแต่ v1.1 (ดู Gotcha 8.11) — แอดมินตอบเอง
- เก็บ media (รูป/วิดีโอ/เสียง/ไฟล์) ขึ้น Google Cloud Storage (GCS)
- มีฟีเจอร์ **custom display name** (เก็บ localStorage) — แก้ชื่อลูกค้าให้แสดง "แอล (เดิม: 🌸✨สาย🌸✨)"

---

## 5. Tech Stack

### Backend ([kongkwun-chat/](kongkwun-chat/))
- **Runtime:** Node.js ≥ 20
- **Framework:** Fastify 5
- **Language:** TypeScript 5.7
- **ORM:** Prisma 6 (MySQL 8)
- **Queue:** BullMQ + Redis 7
- **Storage:** Google Cloud Storage (`@google-cloud/storage`)
- **LINE SDK:** `@line/bot-sdk` v9
- **Validation:** Zod
- **Export:** `docx` (Word), `pdfkit` (PDF) — ใช้ฟอนต์ไทยจาก [kongkwun-chat/fonts/](kongkwun-chat/fonts/)

### Frontend ([kongkwun-chat/frontend/](kongkwun-chat/frontend/))
- **Framework:** Vue 3 + Vite
- **State:** Pinia
- **Router:** vue-router 4
- หน้าหลักอยู่ใน [frontend/src/views/AdminView.vue](kongkwun-chat/frontend/src/views/AdminView.vue)
- **หมายเหตุ:** ใน `src/webhook/admin-page.ts` ฝัง HTML แบบ standalone (ไม่ใช่ Vue) ใช้ serve ที่ `/admin` — เก่ากว่า frontend Vue ใหม่ ต้องตรวจสอบว่าใช้ตัวไหนใน prod

---

## 6. โครงสร้างโปรเจกต์

```
kongkwun-chat/
├── src/
│   ├── app.ts                    ← Entry point (Fastify + workers + routes)
│   ├── config/env.ts             ← Zod env schema (อ่านก่อนทุกครั้ง)
│   ├── database/prisma.ts        ← Prisma client singleton
│   ├── shared/
│   │   ├── types.ts              ← LINE event types
│   │   ├── line-content.ts       ← ดาวน์โหลด media จาก LINE
│   │   ├── gcs-client.ts         ← Upload ไป GCS + signed URL
│   │   ├── ai-reply.ts           ← เรียก AI (askAI)
│   │   └── ai-settings.ts        ← เช็คว่า AI เปิดไหม (global + per-chat)
│   ├── webhook/
│   │   ├── handler.ts            ← รับ LINE webhook + verify signature
│   │   ├── admin-api.ts          ← API endpoints ทั้งหมดของ admin (ยาว!)
│   │   ├── admin-export.ts       ← Export Word/PDF
│   │   └── admin-page.ts         ← HTML ของหน้า /admin (เก่า)
│   └── worker/
│       ├── queue.ts              ← BullMQ + Redis connection
│       ├── event-processor.worker.ts  ← Process LINE events
│       └── db-writer.worker.ts        ← Write conversation ลง DB
├── prisma/schema.prisma          ← DB schema
├── frontend/                     ← Vue 3 admin UI ตัวใหม่
├── k8s/                          ← K8s manifests (namespace, app, mysql, redis)
├── scripts/                      ← SQL init + font test
├── fonts/                        ← Thai TTF (สำคัญ! ขาดไม่ได้สำหรับ PDF)
├── backups/                      ← SQL backups
├── legacy/pre-minio/             ← โค้ดเก่าก่อนใช้ GCS (อย่าใช้)
├── docker-compose.yml            ← Local dev stack
└── Dockerfile                    ← Production image
```

---

## 7. ตั้งค่าเครื่อง Dev ครั้งแรก

### 7.1 Prerequisites
- Node.js ≥ 20
- Docker Desktop (สำหรับ MySQL + Redis local)
- LINE Developers account + Channel access token

### 7.2 Install dependencies

```powershell
cd "kongkwun-chat"
npm install
cd frontend; npm install; cd ..
```

### 7.3 สร้างไฟล์ `.env` (root ของ `kongkwun-chat`)

```env
LINE_CHANNEL_SECRET=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
DATABASE_URL=mysql://smmms_admin:Q6JK6uNDD8t4C6V9euyd@localhost:3307/kwunjai_bot
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
NODE_ENV=development
GCS_BUCKET_NAME=your-bucket-name
GCS_KEY_FILE=./rearn-201506-c7325af234f1.json
```

ดู schema ที่แท้จริงได้จาก [src/config/env.ts](kongkwun-chat/src/config/env.ts) — ถ้า env ขาดจะ crash ตอน boot ทันทีเพราะ Zod parse fail

### 7.4 ขึ้น dependencies (MySQL + Redis)

```powershell
docker compose up -d mysql redis
```

หรือถ้าจะรันแบบ full stack ใน Docker:
```powershell
docker compose up -d
```

### 7.5 รัน migration / push schema

```powershell
npm run db:push        # dev — push schema ตรง ๆ
# หรือ
npm run db:migrate     # สร้าง migration file
```

### 7.6 รัน dev server

```powershell
npm run dev            # backend (tsx watch + .env loader)
cd frontend; npm run dev   # frontend (Vite)
```

Backend จะ:
1. Connect Prisma → MySQL
2. Start `event-processor.worker` และ `db-writer.worker`
3. Listen port 3000
4. Run auto-backfill LINE profiles (background)

---

## 8. สิ่งที่ต้องระวัง / Gotchas

อ่านอันนี้ก่อน — เป็นเรื่องที่คนก่อนหน้าเจ๊งมาแล้ว

### 8.1 BigInt serialization
ใน [src/app.ts](kongkwun-chat/src/app.ts) บรรทัด 1-6 มี monkey-patch `BigInt.prototype.toJSON` เพื่อกัน Fastify crash เพราะ Prisma คืน BigInt สำหรับคอลัมน์ `id`
**อย่าลบ** — ถ้าลบจะ 500 ทุก endpoint ที่คืน `Conversation`

### 8.2 LINE webhook signature
- `handler.ts` ใช้ raw body verify HMAC-SHA256
- ใน `development` mode จะข้าม signature check (เพื่อ test จาก Postman ได้)
- ใน prod ถ้า signature ผิด → 401

### 8.3 LINE quote token field
ใน [prisma/schema.prisma](kongkwun-chat/prisma/schema.prisma) คอลัมน์ `quote_token` เป็น `VARCHAR(500)` — **อย่าลด** เพราะ LINE quote token ยาว ~150 ตัวอักษร และเคยตั้ง 64 แล้ว INSERT fail แบบเงียบ ๆ

### 8.4 Dedup ป้องกัน webhook retry
`event-processor.worker.ts` ใช้ Redis key `dedup:msg:{messageId}` EX 86400s
LINE อาจ retry webhook ถ้า reply ช้า → ระบบต้อง idempotent

### 8.5 Profile cache
ทุก inbound message จะ `getProfile` แล้ว upsert ลง `user_profiles`
**ห้ามเรียก `getProfile` ทุกครั้งจาก admin list** — เพราะจะโดน LINE rate-limit
อ่านจาก DB cache แทน

### 8.6 needsAdmin detection
ใน [event-processor.worker.ts](kongkwun-chat/src/worker/event-processor.worker.ts) มี `NEEDS_ADMIN_KEYWORDS` (ภาษาไทย)
เมื่อ AI ตอบมี keyword พวกนี้ → set `chat_status.needs_admin = true` → frontend จะแสดง bell icon
**ระวัง:** ถ้าจะแก้ keyword ต้องระวังว่า AI reply อาจ template เปลี่ยน

### 8.7 GCS service account
ไฟล์ `rearn-201506-c7325af234f1.json` อยู่ใน root ของ `kongkwun-chat` — **อย่า commit ขึ้น public repo**
ใน Docker จะ mount เป็น read-only volume

### 8.8 Thai font for PDF
[fonts/](kongkwun-chat/fonts/) ต้องมี TTF ภาษาไทย ไม่งั้น PDF export จะออกมาเป็น □□□
Dockerfile copy `fonts/` ทั้งโฟลเดอร์เข้า image
ทดสอบฟอนต์ได้จาก [scripts/test-font.mjs](kongkwun-chat/scripts/test-font.mjs)

### 8.9 Error handler
[src/app.ts](kongkwun-chat/src/app.ts) override Fastify error handler ให้ส่ง `error.message`, `error.code`, และ `stack` (ยกเว้น production) — สะดวกตอน debug จาก browser console

### 8.10 Multipart limit
ตั้งไว้ 200MB (เพดาน video ของ LINE) — limit ต่อชนิดไฟล์บังคับใน handler เอง

### 8.11 AI ปิดสนิทตั้งแต่ v1.1
ใน [event-processor.worker.ts:128-159](kongkwun-chat/src/worker/event-processor.worker.ts#L128-L159) — block `try { askAI() ... }` ถูก comment ทั้งก้อน
- เดิม `if (...)` ถูก comment แต่ body ยังรันอยู่ → AI ตอบทุกข้อความ (บั๊ก)
- ปัจจุบัน comment ทั้ง block + มี header `[AI DISABLED]` อธิบายชัด
- **ลูกค้าพิมพ์มา → ระบบเงียบ → รอแอดมินตอบเอง**
- ถ้าจะเปิดคืน: uncomment block + ต้องครอบ if-condition `isAiEnabled() && isUserAiEnabled(lineUserId) && ...`

### 8.12 Custom display name (localStorage)
ใน [admin-page.ts](kongkwun-chat/src/webhook/admin-page.ts) ปุ่ม ✎ ข้างชื่อใน info panel:
- เก็บใน `localStorage` key: `customName:<lineUserId>` — **ผูกกับ browser** ไม่ sync ข้าม admin
- แสดง format: `แอล (เดิม: 🌸✨สาย🌸✨)` ใน sidebar / chat header / info panel
- ตอน export ส่ง customName ผ่าน body → backend ใช้ใน filename + เนื้อหา
- **ถ้าวันหลังอยากให้ sync ข้าม browser** ต้อง migrate ไป DB (เพิ่ม column `custom_display_name` ใน `user_profiles`)

### 8.13 ตรรกะ tab "ยังไม่ตอบ" v1.1
ใน [admin-page.ts renderUserList](kongkwun-chat/src/webhook/admin-page.ts) — เปลี่ยนจาก `unreadCount > 0` → `direction === 'inbound'`
- ครอบคลุมเคส "อ่านแล้วแต่ลืมตอบ" (unreadCount = 0 + direction = inbound)
- เคสนี้ render ด้วยไฮไลท์เหลืองอ่อน + border ซ้ายเหลือง (CSS class `read-not-replied`)
- ดูสูตรเต็มที่ section 9.2 (notification algorithm)

### 8.14 Performance optimizations v1.1
4 จุดที่ทำใน v1.1 (ไม่กระทบ logic ใด ๆ):
1. **gzip compression** — register `@fastify/compress` ใน [app.ts](kongkwun-chat/src/app.ts) threshold 1KB
2. **Lazy load avatar** — `<img loading="lazy" decoding="async">` ใน `avatarMarkup()`
3. **Visibility-aware polling** — `setInterval` ทุก 5s/3s กั้นด้วย `document.visibilityState === 'visible'` + listener `visibilitychange` catch-up
4. **Debounce search** — text input filter debounce 200ms (search/reset button ไม่ debounce ทำงานทันที)

### 8.15 Note body เป็น optional
ใน [admin-page.ts saveNote](kongkwun-chat/src/webhook/admin-page.ts) + [admin-api.ts upsertNoteHandler](kongkwun-chat/src/webhook/admin-api.ts) — ลบ validation บังคับ `body` ไม่ว่าง
- แอดมิน tag category อย่างเดียวได้ (ไม่ต้องพิมพ์เนื้อหา)
- Render ไม่แสดง div body ว่าง (clean ขึ้น)

---

## 9. Architecture — flow ที่ต้องเข้าใจ

### 9.1 Webhook → DB flow

```
LINE → POST /webhook → verify signature → enqueue "webhook-events"
                                           │
                                           ▼
                          [event-processor.worker]
                            ├─ dedup ด้วย Redis (dedup:msg:{id} TTL 24h)
                            ├─ getProfile + cache UserProfile
                            ├─ download media จาก LINE → upload GCS
                            ├─ [AI DISABLED ตั้งแต่ v1.1] — ไม่เรียก askAI/replyMessage
                            └─ enqueue "db-write" job
                                           │
                                           ▼
                              [db-writer.worker]
                            └─ INSERT conversations (is_read=false ถ้า inbound)
```

**สำคัญ:** Webhook handler ตอบ 200 ทันทีก่อน process — งานหนักทำใน worker
ถ้า worker ตาย → ข้อความหาย (ดู BullMQ retry config)

### 9.2 Notification algorithm (3 สัญญาณอิสระ)

**แหล่งข้อมูล:**
| Source | เก็บอะไร |
|---|---|
| `conversations.is_read` | flag ทุก inbound message |
| `conversations.direction` | `inbound` / `outbound_bot` / `outbound_admin` |
| `chat_status.needs_admin` | flag ต่อ user (ค่าเก่าจากตอน AI ยังเปิด) |

**สูตร render ใน user list:**
```js
showInUnreadTab(user)     = (user.latestDirection === 'inbound')
showUnreadBadge(user)     = (user.unreadCount > 0)
showYellowHighlight(user) = (latestDirection === 'inbound') && (unreadCount === 0)
showRedAdminFlag(user)    = (chat_status.needs_admin === true)
```

3 สัญญาณนี้ **อิสระต่อกัน** — แสดงพร้อมกันได้

**State machine ของ 1 chat (มุมแอดมิน):**
```
inbound + unread → badge เขียว + tab "ยังไม่ตอบ"
                ↓ (admin คลิกเข้า chat → markAsRead)
inbound + read  → ไฮไลท์เหลือง + ยังอยู่ tab "ยังไม่ตอบ"  ← v1.1 ใหม่ (กันลืมตอบ)
                ↓ (admin reply → direction = outbound_admin)
outbound        → ออก tab + ไม่มี indicator
                ↓ (ลูกค้าส่งใหม่)
inbound + unread → กลับเข้า badge เขียวอีก
```

### 9.3 Display name resolution

ตำแหน่ง render ทั้งหมดใช้ priority นี้:
```js
const customName = loadCustomName(userId)              // localStorage
const lineName   = formatDisplayName(displayName, userId)  // user_profiles → conversations → ตัด ID
const final      = customName 
                   ? `${customName} (เดิม: ${lineName})`
                   : lineName
```

`formatDisplayName()` detect raw LINE ID (`/^U[a-f0-9]{16,}$/i`) → ตัดเหลือ `U40c27e66…`

### 9.4 Polling (visibility-aware)

```
ทุก 5s ถ้า tab visible: GET /api/admin/conversations → renderUserList()
ทุก 3s ถ้า tab visible + เปิด chat อยู่: GET /api/admin/conversations/:id

Tab hidden → ข้ามรอบ → กลับมา visible → ดึง 1 ครั้งทันที (catch up)
```

---

## 10. Database

ดู [prisma/schema.prisma](kongkwun-chat/prisma/schema.prisma) เป็นหลัก ตารางหลัก:

| Table | หน้าที่ |
|---|---|
| `conversations` | log message ทุกข้อความ (inbound + outbound) |
| `chat_status` | per-user flags: pinned, isSpam, needsAdmin |
| `user_profiles` | cache LINE display name + avatar |
| `user_notes` | โน้ตที่แอดมินจดเกี่ยวกับ user |
| `note_categories` | หมวดหมู่โน้ต (กำหนดสีได้) |
| `message_templates` | template message สำเร็จรูป |

### 10.1 คำสั่งที่ใช้บ่อย
```powershell
npx prisma studio              # GUI ดู DB
npm run db:generate            # regenerate Prisma client หลังแก้ schema
npm run db:push                # push schema ตรง ๆ (dev)
```

### 10.2 Backup
ดู [backups/](kongkwun-chat/backups/) มีไฟล์ SQL dump เก่าไว้

---

## 11. API endpoints

ดูทั้งหมดที่ [src/app.ts](kongkwun-chat/src/app.ts) บรรทัด 80-115:

**Public**
- `GET  /health` — health check (K8s probe ใช้)
- `POST /webhook`, `POST /line/webhook` — LINE webhook

**Admin** (`/api/admin/*`)
- `reply` — ส่ง message ตอบลูกค้า
- `upload`, `template-asset` — upload media
- `send-template`, `templates` — จัดการ template
- `conversations` — list / get / mark-read / delete
- `chat-status/:lineUserId` — pin / spam / needs-admin
- `notes`, `note-categories` — จัดการโน้ต
- `export/word`, `export/pdf`, `export/bulk/word` — export
- `settings/ai-global`, `conversations/:id/ai-enabled` — toggle AI
- `backfill-profiles` — manual refresh profile cache

**Admin UI**
- `GET /admin` — HTML page (จาก `admin-page.ts`, ตัวเก่า)

---

## 12. Build + Deploy

### 12.1 Build production
```powershell
npm run build         # TypeScript → dist/
npm start             # node dist/app.js
```

### 12.2 Docker

**Registry:** Docker Hub (`docker.io/smartcms/kongkwun-chat`)
**Tags ที่ push แล้ว:** `v2`, `v3`, `v4`, `v5`, `latest`
**Prod ปัจจุบันรัน:** `v2` (deployment.yaml)

```powershell
docker build -t smartcms/kongkwun-chat:vX .
docker push smartcms/kongkwun-chat:vX
```

**สิ่งที่อยู่ใน v5 (ล่าสุด):**
- Bug fixes ทั้งหมด (note save 400, AI fully off, dedup status chip)
- UI cleanup (ลบไอคอน ⚙ + ดินสอที่ไม่ใช้)
- Custom display name + edit modal + format "แอล (เดิม: ...)" + export support
- Tab "ยังไม่ตอบ" รวม "อ่านแล้วยังไม่ตอบ" + ไฮไลท์เหลือง
- Performance: gzip + lazy avatar + visibility polling + debounce search
- Note body เป็น optional
- Backfill profile expansion (รวม row ที่มี raw LINE ID)
- displayName priority `user_profiles → conversations → LINE ID`

Dockerfile รัน `prisma db push --accept-data-loss` ก่อน start — **ระวัง prod data**
(v1.1 ไม่มี schema diff จาก v2 → push ปลอดภัย ไม่มี DROP)

### 12.3 Kubernetes
- Namespace: `kongkwun-bot`
- 2 replicas, HPA enabled (ดู [k8s/app/hpa.yaml](kongkwun-chat/k8s/app/hpa.yaml))
- ConfigMap + Secret แยกใน [k8s/app/](kongkwun-chat/k8s/app/)
- MySQL + Redis เป็น StatefulSet ใน cluster เดียวกัน
- Resources: 100m–500m CPU, 128Mi–512Mi RAM
- Probe path: `/health`

```powershell
# Initial deploy (จาก scratch)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mysql/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/app/

# Rolling update เป็น image ใหม่ (เช่น v5 ตัวล่าสุด)
kubectl set image deployment/kongkwun-bot `
  kongkwun-bot=smartcms/kongkwun-chat:v5 -n kongkwun-bot

# ดู rollout
kubectl rollout status deployment/kongkwun-bot -n kongkwun-bot --timeout=5m

# Rollback ถ้ามีปัญหา (ภายในวินาที)
kubectl rollout undo deployment/kongkwun-bot -n kongkwun-bot

# Backfill profiles หลัง deploy (ดึงชื่อ LINE มา cache user_profiles)
kubectl exec -it deployment/kongkwun-bot -n kongkwun-bot -- `
  curl -X POST http://localhost:3000/api/admin/backfill-profiles
```

**Pre-deploy checklist:**
- [ ] Prod secret มี `GCS_BUCKET_NAME` + `GCS_KEY_FILE` (จำเป็นหลังจาก MinIO → GCS migration)
- [ ] (แนะนำ) backup MySQL ก่อนถ้า schema diff
- [ ] Pinned chat ที่เก่ามาก ๆ อาจไม่อยู่ใน list default — แอดมินใช้ search หา

---

## 13. งานค้างที่ควรเก็บ / ปรับปรุง

DEV คนต่อไปลองพิจารณา:

| # | งาน | ระดับความสำคัญ | ผู้รับผิดชอบ |
|---|---|---|---|
| 1 | **README.md หลัก** ยังเป็น GitLab template default — ต้องเขียนใหม่ | กลาง | _ยังไม่ระบุ_ |
| 2 | **Admin UI สองตัว** — [webhook/admin-page.ts](kongkwun-chat/src/webhook/admin-page.ts) (HTML ฝัง) และ [frontend/](kongkwun-chat/frontend/) (Vue) — ต้องตัดสินใจว่าใช้ตัวไหนแล้วลบอีกตัว | สูง | _ยังไม่ระบุ_ |
| 3 | **legacy/pre-minio** — โค้ดเก่าก่อนเปลี่ยนเป็น GCS — ลบทิ้งได้ถ้าไม่ต้อง reference | ต่ำ | _ยังไม่ระบุ_ |
| 4 | **Tests** — ยังไม่มี test suite เลย | สูง | _ยังไม่ระบุ_ |
| 5 | **Logging** — ใช้ `console.log` + Fastify logger ปนกัน ควร unify | กลาง | _ยังไม่ระบุ_ |
| 6 | **Secrets** — ไฟล์ GCS key อยู่ในโฟลเดอร์ ควรย้ายไป Secret Manager | สูง | _ยังไม่ระบุ_ |
| 7 | **Worker resilience** — BullMQ retry policy ยังไม่ชัด ต้องตรวจสอบ | กลาง | _ยังไม่ระบุ_ |
| 8 | **Rate limit** — ยังไม่มี rate-limit ที่ `/api/admin/*` ใส่ Fastify plugin ดี | กลาง | _ยังไม่ระบุ_ |
| 9 | **Custom name → DB** — ตอนนี้เก็บ localStorage (ผูก browser) — ถ้าอยาก sync ข้าม admin ต้องเพิ่ม column `custom_display_name` ใน `user_profiles` + API endpoint | กลาง | _ยังไม่ระบุ_ |
| 10 | **Pagination/Limit ใน list** — ลองใส่ LIMIT 100 แล้ว revert (admin ใช้งานไม่ครบ) — ถ้า scale หลัก 10k+ ต้องคิดใหม่ (server-side filter + virtual scroll) | กลาง | _ยังไม่ระบุ_ |
| 11 | **AI re-enable plan** — ถ้าจะเปิดคืน uncomment block ใน `event-processor.worker.ts:128-159` + ใส่ toggle UI + เทส keyword `NEEDS_ADMIN_KEYWORDS` | _เมื่อต้องการ_ | _ยังไม่ระบุ_ |
| 12 | **Auth ที่ admin API** — ทุก endpoint `/api/admin/*` เปิดสาธารณะ ต้องใส่ JWT/session ก่อน prod scale | สูง | _ยังไม่ระบุ_ |

---

## 14. ติดต่อ / Reference

### 14.1 ผู้ติดต่อ
- **ทีม:** SMMMS — team@smmms.com
- **Repo:** GitLab (`businessbot/kongkwun-bot`)

### 14.2 Documentation อ้างอิง
- LINE Messaging API: https://developers.line.biz/en/docs/messaging-api/
- Prisma docs: https://www.prisma.io/docs
- BullMQ docs: https://docs.bullmq.io/
- Fastify: https://fastify.dev/

### 14.3 Tips
ถ้ามีคำถามด่วน — รันเซิร์ฟเวอร์แล้วเปิด `/admin` ดู behavior จริงก่อน ระบบนี้ self-documenting ในระดับหนึ่ง

---

## 15. ประวัติการแก้ไขเอกสาร (Revision History)

| เวอร์ชัน | วันที่ | ผู้แก้ไข | รายละเอียดการเปลี่ยนแปลง |
|---|---|---|---|
| 1.0 | 2026-06-09 | ทีม SMMMS | จัดทำเอกสารฉบับแรกสำหรับ handover ให้ DEV คนถัดไป |
| 1.1 | 2026-06-10 | ทีม SMMMS | อัพเดทตามการเปลี่ยนแปลงในโค้ดรอบ image `v4` + `v5`:<br>• Gotchas 8.11–8.15 (AI off, custom name, ตรรกะ ยังไม่ตอบ ใหม่, performance, note body optional)<br>• Section 9 เพิ่ม notification algorithm + display name resolution + polling visibility<br>• Section 12 ปรับ deploy command + pre-deploy checklist + image tag mapping<br>• เพิ่มงานค้าง #9–12 (custom name → DB, pagination, AI re-enable, auth) |
| 1.2 | 2026-06-10 | ทีม SMMMS | เปลี่ยนชื่อเรียกโปรเจกต์ในเอกสารเป็น **"Daikinpromo Chat"** ตามชื่อ admin UI<br>(ชื่อ technical: namespace `kongkwun-bot`, image `smartcms/kongkwun-chat`, branch `version-2.1` ยังคงเดิม) |

