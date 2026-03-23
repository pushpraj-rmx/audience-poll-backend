const mongoose = require("mongoose");
const QrScanSchema = require("../models/QRScan");

function getQrScanModel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const collectionName = `qr_scans_${year}_${month}`;

  // Prevent model overwrite error
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  return mongoose.model(collectionName, QrScanSchema, collectionName);
}

module.exports = getQrScanModel;
