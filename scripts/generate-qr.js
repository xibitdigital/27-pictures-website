#!/usr/bin/env node

const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const URL = "https://twentyseven.pictures/qr.html";
const OUTPUT = path.join(require("os").homedir(), "Downloads", "27pictures-qr.pdf");
const LOGO = path.join(__dirname, "..", "public", "logo.png");

const RED = "#b30000";
const BLACK = "#000000";
const GRAY = "#999999";

async function generate() {
  // Generate QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(URL, {
    width: 300,
    margin: 2,
    color: { dark: BLACK, light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  // Card dimensions (A6-ish, portrait)
  const cardW = 300;
  const cardH = 420;
  const pad = 30;

  const doc = new PDFDocument({
    size: [cardW, cardH],
    margin: 0,
    info: { Title: "27 Pictures — QR Code", Author: "27 Pictures" },
  });

  const stream = fs.createWriteStream(OUTPUT);
  doc.pipe(stream);

  // White background
  doc.rect(0, 0, cardW, cardH).fill("#ffffff");

  // Red top border
  doc.rect(0, 0, cardW, 4).fill(RED);

  let y = pad;

  // Logo
  if (fs.existsSync(LOGO)) {
    const logoW = 40;
    const logoH = 60; // 2:3 ratio
    const logoX = (cardW - logoW) / 2;
    doc.image(LOGO, logoX, y, { width: logoW, height: logoH });
    // Red border around logo
    doc.rect(logoX, y, logoW, logoH).stroke(RED);
    y += logoH + 16;
  }

  // Brand name
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(BLACK)
    .text("27 PICTURES", 0, y, { align: "center", width: cardW });
  y += 28;

  // Red divider
  const divW = 32;
  doc.rect((cardW - divW) / 2, y, divW, 1).fill(RED);
  y += 16;

  // QR code
  const qrSize = 200;
  const qrX = (cardW - qrSize) / 2;
  doc.image(qrBuffer, qrX, y, { width: qrSize, height: qrSize });
  y += qrSize + 14;

  // URL
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(GRAY)
    .text("TWENTYSEVEN.PICTURES/QR", 0, y, { align: "center", width: cardW, characterSpacing: 2 });
  y += 16;

  // Tagline
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(GRAY)
    .text("CINEMA. HORROR. NEURAL SYNTHESIS.", 0, y, { align: "center", width: cardW, characterSpacing: 2 });

  // Red bottom border
  doc.rect(0, cardH - 4, cardW, 4).fill(RED);

  doc.end();

  stream.on("finish", () => {
    console.log(`QR code PDF saved to: ${OUTPUT}`);
  });
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
