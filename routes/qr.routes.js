const express = require("express");
const { generateQr, scanQr } = require("../controllers/qr.controller");
const router = express.Router();

router.post("/generate", generateQr);
router.post('/scan',scanQr)

module.exports = router;