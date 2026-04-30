#!/usr/bin/env node

const QRCode = require("qrcode");
const path = require("path");

const URL = "https://www.instagram.com/27pictures_production";
const OUTPUT = path.join(require("os").homedir(), "Downloads", "27pictures-qr.png");

QRCode.toFile(
  OUTPUT,
  URL,
  {
    width: 600,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  },
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`QR code PNG saved to: ${OUTPUT}`);
  }
);
