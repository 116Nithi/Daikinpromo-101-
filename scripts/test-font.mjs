import PDFDocument from "pdfkit";
import { readFileSync, writeFileSync } from "node:fs";

const font = readFileSync("fonts/Sarabun-Regular.ttf");
const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => {
  writeFileSync("scripts/test-font.pdf", Buffer.concat(chunks));
  console.log("wrote scripts/test-font.pdf");
});

doc.registerFont("Thai", font);
doc.font("Thai");

doc.fontSize(20).text("Thai font test", { align: "center" });
doc.moveDown();
doc.fontSize(14).text("ภาษาไทย: สวัสดีครับ ทดสอบฟอนต์", { align: "center" });
doc.moveDown();
doc.fontSize(14).text("English + Thai mix: Hello สวัสดี 123", { align: "center" });
doc.moveDown();
doc.fontSize(12).text("กล่องล้อมรูป วีดีโอ เวลาที่ส่ง", { align: "center" });

doc.end();
