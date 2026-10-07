// api/_lib/internal-key.js
// ai-request.js -> resume-pdf.js ichki chaqiruvi uchun imzo (bot tokeni bilan)
const crypto = require("crypto");

function internalKey(orderId) {
  return crypto.createHmac("sha256", String(process.env.TELEGRAM_BOT_TOKEN || "")).update("resume-pdf:" + orderId).digest("hex");
}

module.exports = { internalKey };
