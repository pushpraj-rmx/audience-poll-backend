const { Queue } = require("bullmq");
const bullConnection = require("../config/redisBull");

const qrScanQueue = new Queue("qrScanQueue", {
  connection: bullConnection,
});

module.exports = qrScanQueue;
