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
interface ExportQuery { from?: string; to?: string }

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
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
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
      mediaUrl: m.mediaUrl?.startsWith("gs://")
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
 * GET /api/admin/conversations/:lineUserId/export/word
 */
export async function exportWordHandler(
  request: FastifyRequest<{ Params: ExportParams; Querystring: ExportQuery }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { from, to } = request.query;

  const { rows, profile, profileImage, images } = await buildExportBundle(
    lineUserId,
    from,
    to
  );

  const displayName = profile?.displayName || lineUserId;
  const rangeText = from || to
    ? `${from || "(เริ่มต้น)"} ถึง ${to || "(ปัจจุบัน)"}`
    : "ทั้งหมด";

  // --- Build "ภาพรายละเอียด" cell content (the chat log) ---
  const chatParagraphs: Paragraph[] = [];
  let lastDate = "";
  for (const r of rows) {
    const dateStr = r.timestamp.toLocaleDateString("th-TH", {
      day: "2-digit", month: "long", year: "numeric",
    });
    if (dateStr !== lastDate) {
      chatParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: `── ${dateStr} ──`,
              bold: true,
              size: 20,
              color: "6b7280",
            }),
          ],
        })
      );
      lastDate = dateStr;
    }

    const time = r.timestamp.toLocaleTimeString("th-TH", {
      hour: "2-digit", minute: "2-digit",
    });
    const sender = directionLabel(r.direction, displayName);
    const isOutbound = r.direction !== "inbound";
    const senderColor = r.direction === "inbound"
      ? "1e40af"
      : r.direction === "outbound_admin"
        ? "059669"
        : "7c3aed";
    const text = (r.content?.text as string) || "";
    // Any embedded media that docx can render (image or sticker). Video/audio/file stay as placeholder text.
    const isImageType = r.messageType === "image";
    const isStickerType = r.messageType === "sticker";
    const hasMedia = (isImageType || isStickerType) && images.has(r.id);
    const contentText = text || (hasMedia ? "" : placeholderFor(r.messageType, r.content));
    const alignment = isOutbound ? AlignmentType.RIGHT : AlignmentType.LEFT;

    // Sender header: name + time
    chatParagraphs.push(
      new Paragraph({
        alignment,
        spacing: { before: 120, after: 20 },
        children: [
          new TextRun({ text: sender, bold: true, size: 20, color: senderColor }),
          new TextRun({ text: `  ${time}`, size: 16, color: "9ca3af" }),
        ],
      })
    );

    if (contentText) {
      chatParagraphs.push(
        new Paragraph({
          alignment,
          spacing: { after: 80 },
          shading: {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: isOutbound ? "ECFDF5" : "F3F4F6",
          },
          children: [
            new TextRun({
              text: contentText,
              size: 22,
              italics: !text,
              color: text ? "111111" : "6b7280",
            }),
          ],
        })
      );
    }

    if (hasMedia) {
      // Stickers are small square graphics; keep them smaller than photos.
      const mediaSize = isStickerType
        ? { width: 120, height: 120 }
        : { width: 260, height: 195 };
      chatParagraphs.push(
        new Paragraph({
          alignment,
          spacing: { after: 100 },
          children: [
            new ImageRun({
              data: images.get(r.id)!,
              transformation: mediaSize,
            } as any),
          ],
        })
      );
    }
  }

  if (chatParagraphs.length === 0) {
    chatParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "ไม่มีข้อความในช่วงที่เลือก",
            italics: true,
            color: "9ca3af",
          }),
        ],
      })
    );
  }

  // --- Build metadata cells ---
  const nameParagraphs: Paragraph[] = [];
  if (profileImage) {
    nameParagraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: profileImage,
            transformation: { width: 60, height: 60 },
          } as any),
        ],
      })
    );
  }
  nameParagraphs.push(
    new Paragraph({ children: [new TextRun({ text: displayName, bold: true, size: 24 })] })
  );
  nameParagraphs.push(
    new Paragraph({ children: [new TextRun({ text: lineUserId, size: 16, color: "6b7280" })] })
  );

  const dateParagraphs = [
    new Paragraph({ children: [new TextRun({ text: rangeText, size: 22 })] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `(Export ${new Date().toLocaleString("th-TH")} · ${rows.length} ข้อความ)`,
          size: 16,
          color: "888888",
        }),
      ],
    }),
  ];

  const editorParagraphs = [
    new Paragraph({ children: [new TextRun({ text: "Admin", size: 22 })] }),
  ];

  // --- Row helper ---
  const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: "cccccc" };
  const cellBorders = {
    top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
  };
  const cellMargins = { top: 160, bottom: 160, left: 200, right: 200 };
  const makeRow = (label: string, valueParagraphs: Paragraph[]): TableRow =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" },
          verticalAlign: VerticalAlign.CENTER,
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, size: 22 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 82, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          borders: cellBorders,
          margins: cellMargins,
          children: valueParagraphs,
        }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder,
      insideHorizontal: cellBorder, insideVertical: cellBorder,
    },
    rows: [
      makeRow("ชื่อผู้ใช้", nameParagraphs),
      makeRow("วันที่", dateParagraphs),
      makeRow("ภาพรายละเอียด", chatParagraphs),
      makeRow("ผู้แก้ไข", editorParagraphs),
    ],
  });

  const doc = new Document({ sections: [{ children: [table] }] });
  const buffer = await Packer.toBuffer(doc);

  const filename = `chat_${sanitizeFilename(displayName)}_${new Date().toISOString().slice(0, 10)}.docx`;
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
  request: FastifyRequest<{ Params: ExportParams; Querystring: ExportQuery }>,
  reply: FastifyReply
): Promise<void> {
  const { lineUserId } = request.params;
  const { from, to } = request.query;

  const { rows, profile, profileImage, images } = await buildExportBundle(
    lineUserId,
    from,
    to
  );

  const displayName = profile?.displayName || lineUserId;
  const rangeText = from || to
    ? `${from || "(เริ่มต้น)"} ถึง ${to || "(ปัจจุบัน)"}`
    : "ทั้งหมด";

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
  const nameLineH = doc.fontSize(13).heightOfString(displayName) + doc.fontSize(9).heightOfString(lineUserId) + 6;
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
  doc.fontSize(13).fillColor("#111").text(displayName, nameTextX, nameRowStart + padding + 4, {
    width: contentW - (nameTextX - contentLeft) - padding,
  });
  doc.fontSize(9).fillColor("#6b7280").text(lineUserId, {
    width: contentW - (nameTextX - contentLeft) - padding,
  });
  doc.y = nameRowStart + nameRowH;

  // --- Row 2: วันที่ ---
  drawMetaRow(
    "วันที่",
    rangeText,
    `(Export ${new Date().toLocaleString("th-TH")} · ${rows.length} ข้อความ)`
  );

  // --- Row 3: ภาพรายละเอียด (chat content inside the cell, borders span page breaks) ---
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
    const dateStr = r.timestamp.toLocaleDateString("th-TH", {
      day: "2-digit", month: "long", year: "numeric",
    });
    if (dateStr !== lastDate) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#6b7280").text(`── ${dateStr} ──`, chatLeft, doc.y, {
        width: chatWidth, align: "center",
      });
      doc.moveDown(0.4);
      lastDate = dateStr;
    }

    const time = r.timestamp.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const sender = directionLabel(r.direction, displayName);
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
      const imgW = isStickerType ? 120 : 240;
      const imgH = isStickerType ? 120 : 180;
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
        doc.image(images.get(r.id)!, imgX, drawY, { fit: [imgW, imgH] });
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
  drawMetaRow("ผู้แก้ไข", "Admin");

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

  const filename = `chat_${sanitizeFilename(displayName)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  reply
    .header("Content-Type", "application/pdf")
    .header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    )
    .send(buffer);
}
