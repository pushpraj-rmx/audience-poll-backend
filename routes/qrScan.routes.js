const express = require('express');
const { trackQrScan } = require('../controllers/qrScan.controller');
const router = express.Router();

router.post('/track',trackQrScan);

module.exports = router;