/**
 * One-time: drop legacy unique index on `email` only, add unique compound { email, name }.
 * Run from backend folder: node scripts/migrate-participant-email-name-index.js
 * Requires MONGO_URL in .env
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

async function run() {
  const url = process.env.MONGO_URL;
  if (!url) {
    console.error("MONGO_URL missing in .env");
    process.exit(1);
  }

  await mongoose.connect(url);
  const coll = mongoose.connection.collection("participants");

  try {
    await coll.dropIndex("email_1");
    console.log("Dropped index: email_1");
  } catch (e) {
    console.log("dropIndex email_1:", e.codeName || e.message);
  }

  await coll.createIndex(
    { email: 1, name: 1 },
    { unique: true, name: "email_1_name_1" },
  );
  console.log("Created unique compound index: { email: 1, name: 1 }");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
