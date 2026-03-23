const crypto = require("crypto");

function generateFingerprint(req) {
  const raw = [
    req.headers["user-agent"],
    req.ip,
    req.headers["accept-language"],
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = generateFingerprint;