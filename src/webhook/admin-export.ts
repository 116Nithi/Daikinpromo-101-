import { FastifyRequest, FastifyReply } from "fastify";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
} from "docx";
import { messagingApi } from "@line/bot-sdk";
import { prisma } from "../database/prisma";
import { getSignedUrl } from "../shared/gcs-client";
import { env } from "../config/env";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

interface ExportParams { lineUserId: string }
interface ExportQuery { from?: string; to?: string; editor?: string }

// Note payload shipped from the client (localStorage prototype). The server
// trusts the categoryLabel/color so it doesn't need to keep its own category
// map in sync — UI is the source of truth for category metadata.
export interface ExportNote {
  category: string;        // key, e.g. "receipt"
  categoryLabel: string;   // display label, e.g. "ใบเสร็จ"
  color: string;           // dot color, e.g. "#d93025"
  body: string;
  author: string;
  createdAt: string;       // ISO
}
// Topic = lightweight tag picked at export time (vs. detailed Notes which
// have body text). Renders as a single row "หัวข้อที่แจ้ง" under the date.
export interface ExportTopic {
  category: string;        // key, or "other"
  categoryLabel: string;   // display label (incl. user-typed text for "other")
  color: string;
}
interface SingleExportBody {
  notes?: ExportNote[];
  topic?: ExportTopic | null;
  customName?: string | null;
}
interface BulkExportBody {
  notesByUser?: Record<string, ExportNote[]>;
  topicByUser?: Record<string, ExportTopic>;
  customNamesByUser?: Record<string, string>;
}

// แอดมินส่ง customName มาจาก localStorage browser ทำความสะอาดก่อนใช้
// (กัน injection ใน filename + จำกัดความยาว)
function sanitizeCustomName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 100);
  return trimmed || null;
}

// รวม custom name + LINE name เป็น "แอล (เดิม: 🌸✨สาย🌸✨)" — ใช้ในเนื้อหา
function combineDisplayName(customName: string | null, lineName: string): string {
  return customName ? `${customName} (เดิม: ${lineName})` : lineName;
}

function sanitizeEditor(raw: string | undefined): string {
  const v = (raw ?? "").toString().trim();
  return v.length === 0 ? "Admin" : v.slice(0, 60);
}

// Render the date range row. If only one bound is given, show just that date
// (no "ถึง ปัจจุบัน" / "เริ่มต้น ถึง ..." filler). If both bounds are the
// same day, show just that one date. Otherwise "from ถึง to". Empty → "ทั้งหมด".
function formatRangeText(from?: string, to?: string): string {
  if (from && to) return from === to ? from : `${from} ถึง ${to}`;
  if (from) return from;
  if (to) return to;
  return "ทั้งหมด";
}

// YYYYMMDD in Bangkok timezone for filename suffix.
function fmtFilenameDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).replace(/-/g, "");
}

// Filename date should reflect "which day's data is in this report" — pick
// `to` (end of range), fall back to `from`, fall back to today.
function filenameDateFromRange(from?: string, to?: string): Date {
  const pick = to || from;
  if (pick) {
    const d = new Date(pick);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

// Business-day cutoff: admin works 8:00–17:00 Bangkok. Anything that arrives
// after 17:00 belongs to the NEXT day's report (because admin won't process
// it until tomorrow morning). So "report day X" = messages from X-1 17:00
// Bangkok up to X 16:59:59.999 Bangkok.
const BANGKOK_OFFSET_HOURS = 7;
const BUSINESS_DAY_CUTOFF_HOUR = 17; // 17:00 Bangkok

// Lower bound (inclusive): 17:00 Bangkok of (dateStr - 1 day) = (BUSINESS_DAY_CUTOFF_HOUR - BANGKOK_OFFSET_HOURS):00 UTC of (dateStr - 1 day)
function businessDayStart(dateStr: string): Date {
  const d = new Date(dateStr); // YYYY-MM-DD parsed as UTC midnight
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(BUSINESS_DAY_CUTOFF_HOUR - BANGKOK_OFFSET_HOURS, 0, 0, 0);
  return d;
}
// Upper bound (inclusive): 16:59:59.999 Bangkok of dateStr = (CUTOFF - OFFSET - 1):59:59.999 UTC
function businessDayEnd(dateStr: string): Date {
  const d = new Date(dateStr); // YYYY-MM-DD parsed as UTC midnight
  d.setUTCHours(BUSINESS_DAY_CUTOFF_HOUR - BANGKOK_OFFSET_HOURS - 1, 59, 59, 999);
  return d;
}

function sanitizeTopic(raw: unknown): ExportTopic | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = String(r.categoryLabel ?? r.category ?? "").slice(0, 80).trim();
  if (!label) return null;
  return {
    category: String(r.category ?? "").slice(0, 60),
    categoryLabel: label,
    color: /^#[0-9a-fA-F]{6}$/.test(String(r.color ?? "")) ? String(r.color) : "#5f6368",
  };
}

function sanitizeNotes(raw: unknown): ExportNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is Record<string, unknown> => typeof n === "object" && n !== null)
    .map((n) => ({
      category: String(n.category ?? "").slice(0, 60),
      categoryLabel: String(n.categoryLabel ?? n.category ?? "").slice(0, 80),
      color: /^#[0-9a-fA-F]{6}$/.test(String(n.color ?? "")) ? String(n.color) : "#999999",
      body: String(n.body ?? "").slice(0, 2000),
      author: String(n.author ?? "Admin").slice(0, 60),
      createdAt: String(n.createdAt ?? new Date().toISOString()),
    }))
    .filter((n) => n.body.length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Thai+Latin font for PDF. Using Sarabun because Noto Sans Thai is Thai-only (no Latin glyphs).
// If file missing, Helvetica is used as fallback (Thai chars will render as boxes).
// Install: download https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf → fonts/Sarabun-Regular.ttf
const THAI_FONT_PATH = resolve(process.cwd(), "fonts", "Sarabun-Regular.ttf");
const THAI_FONT_BUFFER: Buffer | null = existsSync(THAI_FONT_PATH)
  ? readFileSync(THAI_FONT_PATH)
  : null;
if (!THAI_FONT_BUFFER) {
  console.warn(
    `[export] Thai font not found at ${THAI_FONT_PATH} — PDF will use Helvetica (Thai chars may render as boxes). ` +
    `Download Sarabun-Regular.ttf and place it at the path above.`
  );
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // skip images larger than 20 MB to avoid blowing up the file
const STICKER_URL = (stickerId: string) =>
  `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;

// Server runs in UTC (node:20-alpine), but exports must show Bangkok local time.
const TZ = "Asia/Bangkok";
const fmtDate = (d: Date) =>
  d.toLocaleDateString("th-TH", {
    timeZone: TZ, day: "2-digit", month: "long", year: "numeric",
  });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("th-TH", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  });
const fmtNoteStamp = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("th-TH", {
    timeZone: TZ, day: "2-digit", month: "short",
  })} ${fmtTime(d)}`;
};

// Parse PNG/JPEG/GIF dimensions from the file header so the export can preserve
// aspect ratio. Returns null on unknown format — caller should fall back to a
// fixed box size (so we don't crash on weird inputs).
function getImageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // PNG: 89 50 4E 47, then IHDR with width(BE u32) at off 16, height at off 20
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF: "GIF" then width(LE u16) at off 6, height at off 8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // JPEG: scan for SOFn marker (FFC0..FFC3, FFC5..FFC7, FFC9..FFCB, FFCD..FFCF)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1];
      const isSOF =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        return {
          width: buf.readUInt16BE(off + 7),
          height: buf.readUInt16BE(off + 5),
        };
      }
      const segLen = buf.readUInt16BE(off + 2);
      if (segLen < 2) return null;
      off += 2 + segLen;
    }
  }
  return null;
}

// Scale a (w,h) so it fits within a (maxW,maxH) box without enlarging.
function fitBox(w: number, h: number, maxW: number, maxH: number) {
  if (w <= 0 || h <= 0) return { width: maxW, height: maxH };
  const r = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.max(1, Math.round(w * r)), height: Math.max(1, Math.round(h * r)) };
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > 0 && len > MAX_IMAGE_BYTES) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_IMAGE_BYTES) return null;
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

interface ExportRow {
  id: string;
  direction: string;
  messageType: string;
  content: Record<string, unknown> | null;
  mediaUrl: string | null;
  timestamp: Date;
}

interface ExportBundle {
  rows: ExportRow[];
  profile: { displayName: string; pictureUrl: string | null } | null;
  profileImage: Buffer | null;
  images: Map<string, Buffer>;
}

async function buildExportBundle(
  lineUserId: string,
  from?: string,
  to?: string
): Promise<ExportBundle> {
  const where: Record<string, unknown> = { lineUserId };
  if (from || to) {
    const range: Record<string, Date> = {};
    // Use 17:00 Bangkok cutoff: messages after 17:00 belong to the next
    // business day's report (admin processes them the following morning).
    if (from) range.gte = businessDayStart(from);
    if (to) range.lte = businessDayEnd(to);
    where.timestamp = range;
  }

  const raw = await prisma.conversation.findMany({
    where: where as any,
    orderBy: { timestamp: "asc" },
  });

  const rows: ExportRow[] = await Promise.all(
    raw.map(async (m) => ({
      id: m.id.toString(),
      direction: m.direction,
      messageType: m.messageType,
      content: (m.content ?? null) as Record<string, unknown> | null,
      mediaUrl: (m.mediaUrl?.startsWith("gs://") || m.mediaUrl?.startsWith("s3://"))
        ? await getSignedUrl(m.mediaUrl)
        : m.mediaUrl,
      timestamp: m.timestamp,
    }))
  );

  let profile: ExportBundle["profile"] = null;
  try {
    const p = await client.getProfile(lineUserId);
    profile = { displayName: p.displayName, pictureUrl: p.pictureUrl ?? null };
  } catch {
    // User may have blocked the OA
  }

  const profileImage = profile?.pictureUrl
    ? await fetchImageBuffer(profile.pictureUrl)
    : null;

  const images = new Map<string, Buffer>();
  for (const r of rows) {
    if (r.messageType === "image" && r.mediaUrl) {
      const buf = await fetchImageBuffer(r.mediaUrl);
      if (buf) images.set(r.id, buf);
    } else if (r.messageType === "sticker") {
      // LINE sticker messages have stickerId in content — fetch the PNG from LINE CDN.
      const stickerId = (r.content?.stickerId as string) || "";
      if (stickerId) {
        const buf = await fetchImageBuffer(STICKER_URL(stickerId));
        if (buf) images.set(r.id, buf);
      }
    }
  }

  return { rows, profile, profileImage, images };
}

function directionLabel(direction: string, customerName: string): string {
  if (direction === "outbound_admin") return "Admin";
  if (direction === "outbound_bot") return "Bot";
  return customerName;
}

function placeholderFor(messageType: string, content: Record<string, unknown> | null): string {
  const filename = (content?.filename as string) || "";
  if (messageType === "video") return "🎥 [Video]";
  if (messageType === "audio") return "🎵 [Audio]";
  if (messageType === "file") return `📎 [File: ${filename || "unnamed"}]`;
  return `[${messageType}]`;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9ก-๙_\-.]/g, "_").slice(0, 60);
}

/**
 * Build the Document "section children" (title + metadata table) for one user.
 * Reused by both single and bulk Word export — the bulk handler stitches multiple
 * sections into a single Document so each user starts on a fresh page.
 */
function buildWordSectionChildren(args: {
  rows: ExportRow[];
  profile: ExportBundle["profile"];
  profileImage: Buffer | null;
  images: Map<string, Buffer>;
  displayName: string;
  // ชื่อสั้นสำหรับ sender label ในแต่ละบรรทัด — เลี่ยงใส่ "แอล (เดิม: ...)" ซ้ำ ๆ
  senderShortName?: string;
  rangeText: string;
  editor: string;
  notes: ExportNote[];
  topic: ExportTopic | null;
}): (Paragraph | Table)[] {
  const { rows, profileImage, images, displayName, senderShortName, rangeText, editor, notes, topic } = args;
  const senderLabel = senderShortName || displayName;

  // --- Styling tokens (match PDF palette) ---
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };
  const cellBorders = {
    top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
  };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = {
    top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
  };
  const noTableBorders = {
    ...noBorders,
    insideHorizontal: noBorder,
    insideVertical: noBorder,
  };
  const cellMargins = { top: 160, bottom: 160, left: 200, right: 200 };
  const LABEL_TEXT_COLOR = "374151";
  const MUTED_TEXT_COLOR = "6b7280";
  const LABEL_BG = "F3F4F6";

  // Chat bubbles (nested tables so each bubble has its own width + alignment)
  const chatChildren: (Paragraph | Table)[] = [];
  const BUBBLE_SPACER_PERCENT = 30;
  const BUBBLE_CONTENT_PERCENT = 70;
  const buildBubble = (
    bubbleParagraphs: Paragraph[],
    isOutbound: boolean,
    bubbleFill: string
  ): Table => {
    const contentCell = new TableCell({
      width: { size: BUBBLE_CONTENT_PERCENT, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: bubbleFill },
      borders: noBorders,
      margins: { top: 120, bottom: 120, left: 180, right: 180 },
      children: bubbleParagraphs,
    });
    const spacerCell = new TableCell({
      width: { size: BUBBLE_SPACER_PERCENT, type: WidthType.PERCENTAGE },
      borders: noBorders,
      children: [new Paragraph({ children: [] })],
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noTableBorders,
      rows: [
        new TableRow({
          children: isOutbound ? [spacerCell, contentCell] : [contentCell, spacerCell],
        }),
      ],
    });
  };

  let lastDate = "";
  let lastDirection = "";
  for (const r of rows) {
    const dateStr = fmtDate(r.timestamp);
    if (dateStr !== lastDate) {
      chatChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
          children: [
            new TextRun({
              text: `── ${dateStr} ──`,
              bold: true, size: 20, color: MUTED_TEXT_COLOR, noProof: true,
            }),
          ],
        })
      );
      lastDate = dateStr;
      lastDirection = "";
    }

    const time = fmtTime(r.timestamp);
    // sender label ใน Word: ใช้ senderLabel (ชื่อสั้น) — เลี่ยง "แอล (เดิม: ...)" ซ้ำทุกบรรทัด
    const sender = directionLabel(r.direction, senderLabel);
    const isOutbound = r.direction !== "inbound";
    const senderColor = r.direction === "inbound" ? "1e40af"
      : r.direction === "outbound_admin" ? "059669" : "7c3aed";
    const text = (r.content?.text as string) || "";
    const isImageType = r.messageType === "image";
    const isStickerType = r.messageType === "sticker";
    const hasMedia = (isImageType || isStickerType) && images.has(r.id);
    const imgLoadFailed = (isImageType || isStickerType) && !images.has(r.id);
    const showSenderHeader = r.direction !== lastDirection;
    const bubbleFill = isOutbound ? "ECFDF5" : "F3F4F6";

    const bubbleParagraphs: Paragraph[] = [];
    if (showSenderHeader) {
      bubbleParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: sender, bold: true, size: 20, color: senderColor, noProof: true }),
            new TextRun({ text: `  ${time}`, size: 16, color: "9ca3af", noProof: true }),
          ],
        })
      );
    } else {
      bubbleParagraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: time, size: 16, color: "9ca3af", noProof: true })],
        })
      );
    }

    if (text) {
      bubbleParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text, size: 22, color: "111111", noProof: true })],
        })
      );
    }

    if (hasMedia) {
      const buf = images.get(r.id)!;
      const dim = getImageSize(buf);
      const maxW = isStickerType ? 120 : 280;
      const maxH = isStickerType ? 120 : 280;
      const mediaSize = dim
        ? fitBox(dim.width, dim.height, maxW, maxH)
        : { width: maxW, height: maxH };
      bubbleParagraphs.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            new ImageRun({ data: buf, transformation: mediaSize } as any),
          ],
        })
      );
    } else if (imgLoadFailed) {
      bubbleParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isStickerType ? "[สติกเกอร์ — โหลดไม่ได้]" : "[ภาพ — โหลดไม่ได้]",
              size: 20, italics: true, color: MUTED_TEXT_COLOR, noProof: true,
            }),
          ],
        })
      );
    } else if (!text) {
      bubbleParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: placeholderFor(r.messageType, r.content),
              size: 20, italics: true, color: MUTED_TEXT_COLOR, noProof: true,
            }),
          ],
        })
      );
    }

    chatChildren.push(buildBubble(bubbleParagraphs, isOutbound, bubbleFill));
    chatChildren.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
    lastDirection = r.direction;
  }

  if (chatChildren.length === 0) {
    chatChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "ไม่มีข้อความในช่วงที่เลือก",
            italics: true, color: "9ca3af", noProof: true,
          }),
        ],
      })
    );
  }

  // Row helper
  const makeRow = (
    label: string,
    valueChildren: (Paragraph | Table)[],
    labelSubText?: string
  ): TableRow => {
    const labelChildren: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({ text: label, bold: true, size: 22, color: LABEL_TEXT_COLOR, noProof: true }),
        ],
      }),
    ];
    if (labelSubText) {
      labelChildren.push(
        new Paragraph({
          spacing: { before: 40 },
          children: [
            new TextRun({ text: labelSubText, size: 16, color: MUTED_TEXT_COLOR, noProof: true }),
          ],
        })
      );
    }
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: LABEL_BG },
          verticalAlign: VerticalAlign.TOP,
          borders: cellBorders,
          margins: cellMargins,
          children: labelChildren,
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          borders: cellBorders,
          margins: cellMargins,
          children: valueChildren,
        }),
      ],
    });
  };

  // Name cell: avatar + name side-by-side (nested borderless table)
  const nameStack: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: displayName, bold: true, size: 28, noProof: true })] }),
  ];
  const nameCellChildren: (Paragraph | Table)[] = profileImage
    ? [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
            insideHorizontal: noBorder, insideVertical: noBorder,
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 1200, type: WidthType.DXA },
                  borders: noBorders,
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 0, bottom: 0, left: 0, right: 200 },
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: profileImage,
                          transformation: { width: 64, height: 64 },
                        } as any),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  borders: noBorders,
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  children: nameStack,
                }),
              ],
            }),
          ],
        }),
      ]
    : nameStack;

  const dateParagraphs: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: rangeText, size: 22, noProof: true })] }),
  ];

  // Notes block: each note = [category dot+label + meta] / [body], stacked.
  const buildNoteParagraphs = (n: ExportNote, isLast: boolean): Paragraph[] => {
    const colorHex = n.color.replace(/^#/, "");
    return [
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: "● ",
            size: 16, color: colorHex, noProof: true,
          }),
          new TextRun({
            text: n.categoryLabel,
            size: 18, bold: true, color: LABEL_TEXT_COLOR, noProof: true,
          }),
          new TextRun({
            text: `    ${fmtNoteStamp(n.createdAt)} · ${n.author}`,
            size: 16, color: MUTED_TEXT_COLOR, noProof: true,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: isLast ? 0 : 200 },
        children: [
          new TextRun({ text: n.body, size: 20, color: "1a1a1a", noProof: true }),
        ],
      }),
    ];
  };

  const noteParagraphs: Paragraph[] = notes.length === 0
    ? [
        new Paragraph({
          children: [
            new TextRun({
              text: "(ไม่มีบันทึก)",
              size: 20, italics: true, color: MUTED_TEXT_COLOR, noProof: true,
            }),
          ],
        }),
      ]
    : notes.flatMap((n, i) => buildNoteParagraphs(n, i === notes.length - 1));

  const editorParagraphs: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: editor, size: 22, noProof: true })] }),
  ];

  const topicParagraphs: Paragraph[] = topic
    ? [
        new Paragraph({
          children: [
            new TextRun({
              text: "● ",
              size: 20, color: topic.color.replace(/^#/, ""), noProof: true,
            }),
            new TextRun({ text: topic.categoryLabel, size: 22, noProof: true }),
          ],
        }),
      ]
    : [
        new Paragraph({
          children: [
            new TextRun({
              text: "(ไม่ระบุหัวข้อ)",
              size: 20, italics: true, color: MUTED_TEXT_COLOR, noProof: true,
            }),
          ],
        }),
      ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
      insideHorizontal: cellBorder, insideVertical: cellBorder,
    },
    rows: [
      makeRow("ชื่อผู้ใช้", nameCellChildren),
      makeRow("วันที่", dateParagraphs),
      makeRow("หัวข้อที่แจ้ง", topicParagraphs),
      makeRow("ภาพรายละเอียด", chatChildren, `${rows.length} ข้อความ`),
      makeRow("ผู้แก้ไข", editorParagraphs),
    ],
  });

  return [table];
}

/**
 * GET /api/admin/conversations/:lineUserId/export/word
 */
export async function exportWordHandler(
  request: FastifyRequest<{ Params: ExportParams; Querystring: ExportQuery; Body: SingleExportBody }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { from, to } = request.query;
  const editor = sanitizeEditor(request.query.editor);
  const notes = sanitizeNotes(request.body?.notes);
  const topic = sanitizeTopic(request.body?.topic);

  const bundle = await buildExportBundle(lineUserId, from, to);
  const lineName = bundle.profile?.displayName || lineUserId;
  const customName = sanitizeCustomName(request.body?.customName);
  // displayName ในเนื้อหา = "แอล (เดิม: 🌸✨สาย🌸✨)" ถ้ามี custom
  const displayName = combineDisplayName(customName, lineName);
  // filename ใช้แค่ custom (กระชับ ไม่มีวงเล็บ) — ถ้าไม่มีก็ใช้ LINE name
  const filenameName = customName || lineName;
  const rangeText = formatRangeText(from, to);

  const children = buildWordSectionChildren({
    rows: bundle.rows,
    profile: bundle.profile,
    profileImage: bundle.profileImage,
    images: bundle.images,
    displayName,
    // ใช้ custom name ใน sender label ถ้ามี ไม่งั้นใช้ชื่อ LINE
    senderShortName: customName || lineName,
    rangeText, editor, notes, topic,
  });

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  const filename = `DaikinPromo_${sanitizeFilename(filenameName)}_${fmtFilenameDate(filenameDateFromRange(from, to))}.docx`;
  reply
    .header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    .header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    )
    .send(buffer);
}

/**
 * GET /api/admin/export/bulk/word?ids=u1,u2,u3&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Combines multiple users' chat exports into a single Word document.
 * Each user starts on its own page (via separate Document sections).
 */
export async function exportBulkWordHandler(
  request: FastifyRequest<{ Querystring: { ids?: string; from?: string; to?: string; editor?: string }; Body: BulkExportBody }>,
  reply: FastifyReply
): Promise<void> {
  const { from, to } = request.query;
  const editor = sanitizeEditor(request.query.editor);
  const notesByUser = request.body?.notesByUser ?? {};
  const topicByUser = request.body?.topicByUser ?? {};
  const customNamesByUser = request.body?.customNamesByUser ?? {};
  const ids = (request.query.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const BULK_MAX = 100;
  if (ids.length === 0) {
    reply.code(400).send({ error: "Missing or empty 'ids' query parameter" });
    return;
  }
  if (ids.length > BULK_MAX) {
    reply.code(400).send({
      error: `Too many ids: max ${BULK_MAX} per request (got ${ids.length})`,
    });
    return;
  }

  const rangeText = formatRangeText(from, to);

  // Build one section per user so each starts on its own page
  const sections = await Promise.all(
    ids.map(async (lineUserId) => {
      const bundle = await buildExportBundle(lineUserId, from, to);
      const lineName = bundle.profile?.displayName || lineUserId;
      const customName = sanitizeCustomName(customNamesByUser[lineUserId]);
      // ในเอกสาร: "แอล (เดิม: 🌸✨สาย🌸✨)" ถ้ามี custom ของ user นี้
      const displayName = combineDisplayName(customName, lineName);
      const children = buildWordSectionChildren({
        rows: bundle.rows,
        profile: bundle.profile,
        profileImage: bundle.profileImage,
        images: bundle.images,
        displayName,
        senderShortName: customName || lineName,
        rangeText, editor,
        notes: sanitizeNotes(notesByUser[lineUserId]),
        topic: sanitizeTopic(topicByUser[lineUserId]),
      });
      return { children };
    })
  );

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);

  const filename = `DaikinPromo_ChatReport_${fmtFilenameDate(filenameDateFromRange(from, to))}.docx`;
  reply
    .header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    .header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    )
    .send(buffer);
}

/**
 * GET /api/admin/conversations/:lineUserId/export/pdf
 */
export async function exportPdfHandler(
  request: FastifyRequest<{ Params: ExportParams; Querystring: ExportQuery; Body: SingleExportBody }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { from, to } = request.query;
  const editor = sanitizeEditor(request.query.editor);
  const notes = sanitizeNotes(request.body?.notes);
  const topic = sanitizeTopic(request.body?.topic);

  const { rows, profile, profileImage, images } = await buildExportBundle(
    lineUserId,
    from,
    to
  );

  const lineName = profile?.displayName || lineUserId;
  const customName = sanitizeCustomName(request.body?.customName);
  // PDF: ใช้ "แอล (เดิม: 🌸✨สาย🌸✨)" ในเนื้อหา + custom สำหรับ filename
  const displayName = combineDisplayName(customName, lineName);
  const filenameName = customName || lineName;
  const rangeText = formatRangeText(from, to);

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const endPromise = new Promise<Buffer>((res) =>
    doc.on("end", () => res(Buffer.concat(chunks)))
  );

  // Track the current page index so we can later redraw borders across page breaks.
  let currentPageIdx = 0;
  doc.on("pageAdded", () => {
    currentPageIdx++;
  });

  if (THAI_FONT_BUFFER) {
    doc.registerFont("Thai", THAI_FONT_BUFFER);
    doc.font("Thai");
  } else {
    doc.font("Helvetica");
  }

  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const tableW = pageRight - pageLeft;
  const labelColW = 120;
  const contentLeft = pageLeft + labelColW;
  const contentW = tableW - labelColW;
  const padding = 10;

  // Draw a simple 2-column row (label | value) with backgrounds + borders.
  const drawMetaRow = (label: string, value: string, extraText?: string) => {
    const startY = doc.y;
    const valueText = extraText ? `${value}\n${extraText}` : value;
    const lineH = doc.fontSize(11).heightOfString(valueText, { width: contentW - padding * 2 });
    const rowH = Math.max(lineH + padding * 2, 36);

    doc.save();
    doc.fillColor("#f3f4f6").rect(pageLeft, startY, labelColW, rowH).fill();
    doc.strokeColor("#d1d5db").lineWidth(0.6);
    doc.rect(pageLeft, startY, tableW, rowH).stroke();
    doc.moveTo(contentLeft, startY).lineTo(contentLeft, startY + rowH).stroke();
    doc.restore();

    doc.fontSize(11).fillColor("#374151")
      .text(label, pageLeft + padding, startY + padding, { width: labelColW - padding * 2 });

    doc.fontSize(11).fillColor("#111")
      .text(value, contentLeft + padding, startY + padding, { width: contentW - padding * 2 });
    if (extraText) {
      doc.fontSize(9).fillColor("#888").text(extraText, {
        width: contentW - padding * 2,
      });
    }

    doc.y = startY + rowH;
  };

  // --- Row 1: ชื่อผู้ใช้ (with profile pic if available) ---
  const nameRowStart = doc.y;
  const nameLineH = doc.fontSize(13).heightOfString(displayName) + 6;
  const nameRowH = profileImage
    ? Math.max(nameLineH + padding * 2, 80)
    : Math.max(nameLineH + padding * 2, 40);

  doc.save();
  doc.fillColor("#f3f4f6").rect(pageLeft, nameRowStart, labelColW, nameRowH).fill();
  doc.strokeColor("#d1d5db").lineWidth(0.6);
  doc.rect(pageLeft, nameRowStart, tableW, nameRowH).stroke();
  doc.moveTo(contentLeft, nameRowStart).lineTo(contentLeft, nameRowStart + nameRowH).stroke();
  doc.restore();

  doc.fontSize(11).fillColor("#374151")
    .text("ชื่อผู้ใช้", pageLeft + padding, nameRowStart + padding, { width: labelColW - padding * 2 });

  let nameTextX = contentLeft + padding;
  if (profileImage) {
    try {
      doc.image(profileImage, contentLeft + padding, nameRowStart + padding, { fit: [60, 60] });
      nameTextX = contentLeft + padding + 70;
    } catch {
      // ignore bad image
    }
  }
  const nameY = profileImage
    ? nameRowStart + (nameRowH - doc.fontSize(13).heightOfString(displayName)) / 2
    : nameRowStart + padding + 4;
  doc.fontSize(13).fillColor("#111").text(displayName, nameTextX, nameY, {
    width: contentW - (nameTextX - contentLeft) - padding,
  });
  doc.y = nameRowStart + nameRowH;

  // --- Row 2: วันที่ ---
  drawMetaRow("วันที่", rangeText);

  // --- Row 3: หัวข้อที่แจ้ง (single topic tag picked at export time) ---
  {
    const startY = doc.y;
    const valueText = topic ? topic.categoryLabel : "(ไม่ระบุหัวข้อ)";
    const lineH = doc.fontSize(11).heightOfString(valueText, { width: contentW - padding * 2 - (topic ? 14 : 0) });
    const rowH = Math.max(lineH + padding * 2, 36);

    doc.save();
    doc.fillColor("#f3f4f6").rect(pageLeft, startY, labelColW, rowH).fill();
    doc.strokeColor("#d1d5db").lineWidth(0.6);
    doc.rect(pageLeft, startY, tableW, rowH).stroke();
    doc.moveTo(contentLeft, startY).lineTo(contentLeft, startY + rowH).stroke();
    doc.restore();

    doc.fontSize(11).fillColor("#374151")
      .text("หัวข้อที่แจ้ง", pageLeft + padding, startY + padding, { width: labelColW - padding * 2 });

    if (topic) {
      const dotX = contentLeft + padding + 4;
      const dotY = startY + padding + 7;
      doc.save();
      doc.fillColor(topic.color).circle(dotX, dotY, 3).fill();
      doc.restore();
      doc.fontSize(11).fillColor("#111")
        .text(topic.categoryLabel, contentLeft + padding + 14, startY + padding, {
          width: contentW - padding * 2 - 14,
        });
    } else {
      doc.fontSize(11).fillColor("#9ca3af")
        .text("(ไม่ระบุหัวข้อ)", contentLeft + padding, startY + padding, {
          width: contentW - padding * 2,
        });
    }

    doc.y = startY + rowH;
  }

  // --- Row 4: ภาพรายละเอียด (chat content inside the cell, borders span page breaks) ---
  // Record start position BEFORE rendering. We'll render content first, then use bufferedPages
  // at the end to overlay the label column bg + outer borders (which won't cover content because
  // content is strictly inside the content column).
  const detailStartY = doc.y;
  const detailStartPage = currentPageIdx;

  // Chat content is positioned STRICTLY inside the content column so the label col bg
  // we draw later doesn't overlap it.
  const chatLeft = contentLeft + padding;
  const chatWidth = contentW - padding * 2;

  // Top padding before first message
  doc.y = detailStartY + padding;

  if (rows.length === 0) {
    doc.fontSize(10).fillColor("#9ca3af").text("(ไม่มีข้อความในช่วงที่เลือก)", chatLeft, doc.y, {
      width: chatWidth, align: "center",
    });
    doc.moveDown(1);
  }

  let lastDate = "";
  for (const r of rows) {
    const dateStr = fmtDate(r.timestamp);
    if (dateStr !== lastDate) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#6b7280").text(`── ${dateStr} ──`, chatLeft, doc.y, {
        width: chatWidth, align: "center",
      });
      doc.moveDown(0.4);
      lastDate = dateStr;
    }

    const time = fmtTime(r.timestamp);
    // PDF sender label: ใช้ชื่อสั้น (customName || lineName) ไม่ใส่วงเล็บซ้ำทุกบรรทัด
    const sender = directionLabel(r.direction, customName || lineName);
    const isOutbound = r.direction !== "inbound";
    const senderColor =
      r.direction === "inbound"
        ? "#1e40af"
        : r.direction === "outbound_admin"
          ? "#059669"
          : "#7c3aed";
    const alignOpt: "left" | "right" = isOutbound ? "right" : "left";

    const text = (r.content?.text as string) || "";
    const isImageType = r.messageType === "image";
    const isStickerType = r.messageType === "sticker";
    const hasMedia = (isImageType || isStickerType) && images.has(r.id);

    // Sender header line — same fontSize for the whole line so `continued` layout stays sane.
    doc.fontSize(10);
    doc.fillColor(senderColor).text(sender, chatLeft, doc.y, {
      width: chatWidth, align: alignOpt, continued: true,
    });
    doc.fillColor("#9ca3af").text(`  ${time}`);
    doc.moveDown(0.15);

    if (text) {
      doc.fontSize(11).fillColor("#111").text(text, chatLeft, doc.y, {
        width: chatWidth, align: alignOpt,
      });
    } else if (!hasMedia) {
      doc.fontSize(10).fillColor("#6b7280").text(
        placeholderFor(r.messageType, r.content),
        chatLeft, doc.y,
        { width: chatWidth, align: alignOpt }
      );
    }

    if (hasMedia) {
      const buf = images.get(r.id)!;
      const dim = getImageSize(buf);
      const maxW = isStickerType ? 120 : 280;
      const maxH = isStickerType ? 120 : 280;
      const { width: imgW, height: imgH } = dim
        ? fitBox(dim.width, dim.height, maxW, maxH)
        : { width: maxW, height: maxH };
      const imgX = isOutbound ? chatLeft + chatWidth - imgW : chatLeft;
      const imgStartY = doc.y + 4;

      // Pre-page-break: if the image won't fit on this page, move to next page first.
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      if (imgStartY + imgH + 8 > pageBottom) {
        doc.addPage();
        doc.x = chatLeft;
        doc.y = doc.page.margins.top + padding;
      }

      const drawY = doc.y + 4;
      try {
        doc.image(buf, imgX, drawY, { width: imgW, height: imgH });
        // Advance y past the image explicitly — moveDown() uses line-height which is unreliable here.
        doc.y = drawY + imgH + 8;
      } catch {
        doc.fontSize(10).fillColor("#6b7280").text("[image — decode failed]", chatLeft, doc.y, {
          width: chatWidth, align: alignOpt,
        });
      }
    }

    doc.moveDown(0.8);

    // Post-message page-break check — keep a generous margin so the NEXT message header
    // doesn't print a few lines then break mid-content.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
      doc.x = chatLeft;
      doc.y = doc.page.margins.top + padding;
    }
  }

  const detailEndY = doc.y + padding;
  const detailEndPage = currentPageIdx;

  // --- Row 4: ผู้แก้ไข ---
  doc.y = detailEndY;
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
  drawMetaRow("ผู้แก้ไข", editor);

  // --- Post-process: draw borders + label-col bg for the ภาพรายละเอียด row on every page
  // it spans. We do this AFTER content is rendered because the row height is variable. ---
  const bookmarkPage = currentPageIdx; // remember where we are (last page)
  const pr = doc.bufferedPageRange();
  for (let i = pr.start; i < pr.start + pr.count; i++) {
    if (i < detailStartPage || i > detailEndPage) continue;
    doc.switchToPage(i);

    const topY = i === detailStartPage ? detailStartY : doc.page.margins.top;
    const bottomY = i === detailEndPage ? detailEndY : doc.page.height - doc.page.margins.bottom;
    const rowH = bottomY - topY;
    if (rowH <= 0) continue;

    doc.save();
    // Label column background (gray)
    doc.fillColor("#f3f4f6").rect(pageLeft, topY, labelColW, rowH).fill();
    // Outer rectangle
    doc.strokeColor("#d1d5db").lineWidth(0.6);
    doc.rect(pageLeft, topY, tableW, rowH).stroke();
    // Vertical divider between label and content columns
    doc.moveTo(contentLeft, topY).lineTo(contentLeft, topY + rowH).stroke();
    doc.restore();

    // Label text only on the first page of the detail row
    if (i === detailStartPage) {
      doc.fontSize(11).fillColor("#374151").text(
        "ภาพรายละเอียด",
        pageLeft + padding,
        topY + padding,
        { width: labelColW - padding * 2 }
      );
      doc.fontSize(9).fillColor("#6b7280").text(
        `${rows.length} ข้อความ`,
        pageLeft + padding,
        topY + padding + 16,
        { width: labelColW - padding * 2 }
      );
    }
  }
  // Return to the last page so doc.end() doesn't accidentally flush from the wrong page.
  doc.switchToPage(bookmarkPage);

  doc.end();
  const buffer = await endPromise;

  const filename = `DaikinPromo_${sanitizeFilename(filenameName)}_${fmtFilenameDate(filenameDateFromRange(from, to))}.pdf`;
  reply
    .header("Content-Type", "application/pdf")
    .header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    )
    .send(buffer);
}
