#!/usr/bin/env node

const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const URL = "https://www.instagram.com/27pictures_production";
const OUTPUT = path.join(require("os").homedir(), "Downloads", "27pictures-qr.pdf");
const LOGO = path.join(__dirname, "..", "public", "logo.png");
const FONT_PLAYFAIR = path.join(
  __dirname,
  "..",
  "node_modules/@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff"
);
const FONT_INTER = path.join(__dirname, "..", "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff");
const FONT_INTER_BOLD = path.join(__dirname, "..", "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff");

const RED = "#b30000";
const BLACK = "#000000";
const GRAY = "#999999";
const PADDING = 10;

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

  doc.registerFont("Playfair", FONT_PLAYFAIR);
  doc.registerFont("Inter", FONT_INTER);
  doc.registerFont("Inter-Bold", FONT_INTER_BOLD);

  const stream = fs.createWriteStream(OUTPUT);
  doc.pipe(stream);

  // White background
  doc.rect(0, 0, cardW, cardH).fill("#ffffff");

  // Red top border
  doc.rect(0, 0, cardW, 4).fill(RED);

  let y = pad;

  // Logo
  if (fs.existsSync(LOGO)) {
    const logoW = 80;
    const logoH = 120; // 2:3 ratio
    const logoX = (cardW - logoW) / 2;
    doc.image(LOGO, logoX, y, { width: logoW, height: logoH });
    y += logoH + PADDING;
  }

  // QR code
  const qrSize = 200;
  const qrX = (cardW - qrSize) / 2;
  doc.image(qrBuffer, qrX, y, { width: qrSize, height: qrSize });
  y += qrSize + PADDING;

  // URL
  doc
    .font("Inter")
    .fontSize(8)
    .fillColor(GRAY)
    .text("INSTAGRAM", 0, y, { align: "center", width: cardW, characterSpacing: 2 });
  y += 14;

  // Instagram
  doc
    .font("Inter")
    .fontSize(8)
    .fillColor(GRAY)
    .text("@27PICTURES_PRODUCTION", 0, y, { align: "center", width: cardW, characterSpacing: 1 });
  y += PADDING;

  // Tagline
  doc
    .font("Inter")
    .fontSize(4)
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
