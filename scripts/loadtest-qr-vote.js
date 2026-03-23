/**
 * Local load test (no extra deps):
 * - Generates a QR token
 * - Runs N parallel "audience" flows:
 *   scan -> submit-info -> submit-final
 *
 * Usage:
 *   BASE_URL="http://localhost:5500" \
 *   CONTEST_ID="..." SEASON_ID="..." ROUND_ID="..." PARTICIPANT_ID="..." \
 *   node scripts/loadtest-qr-vote.js
 *
 * Optional:
 *   VUS=200 ITERATIONS=1 CONCURRENCY=50 STARS=7
 *
 * Notes:
 * - Make sure backend API is running and Redis is up.
 * - For realistic scan logging, run the worker in a separate terminal:
 *     node workers/qrWorker.js
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5500";
const API = `${BASE_URL.replace(/\/$/, "")}/api`;

const CONTEST_ID = process.env.CONTEST_ID || "697c439ab061718eabc1eccf";
const SEASON_ID = process.env.SEASON_ID || "697c6f2ac1bf5b24be3b9d93";
const ROUND_ID = process.env.ROUND_ID || "698ae355080a6493f52612d9";
const PARTICIPANT_ID = process.env.PARTICIPANT_ID || "69b9403ebf5caa60b4022b52";

const VUS = Number(process.env.VUS || 200);
const ITERATIONS = Number(process.env.ITERATIONS || 1);
const CONCURRENCY = Number(process.env.CONCURRENCY || 50);
const STARS = Number(process.env.STARS || 7);

function assertEnv() {
  const missing = [];
  if (!CONTEST_ID) missing.push("CONTEST_ID");
  if (!SEASON_ID) missing.push("SEASON_ID");
  if (!ROUND_ID) missing.push("ROUND_ID");
  if (!PARTICIPANT_ID) missing.push("PARTICIPANT_ID");
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function httpJsonWithHeaders(method, url, body, headers) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${url}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function parseTokenFromVoteUrl(voteUrl) {
  const idx = voteUrl.indexOf("/vote/");
  if (idx === -1) return null;
  return voteUrl.slice(idx + "/vote/".length);
}

async function generateToken() {
  const data = await httpJsonWithHeaders("POST", `${API}/qr/generate`, {
    contestId: CONTEST_ID,
    seasonId: SEASON_ID,
    roundId: ROUND_ID,
    participantId: PARTICIPANT_ID,
  });
  if (!data?.success || !data?.voteUrl) {
    throw new Error(`QR generate failed: ${JSON.stringify(data)}`);
  }
  const token = parseTokenFromVoteUrl(data.voteUrl);
  if (!token) throw new Error(`Cannot parse token from voteUrl: ${data.voteUrl}`);
  return token;
}

async function runAudienceFlow({ token, vu, iteration }) {
  const uniq = `${Date.now()}_${iteration}_${vu}_${Math.random().toString(16).slice(2)}`;
  const voter = {
    name: `loadtest_${uniq}`,
    email: `loadtest_${uniq}@example.com`,
    phone: `9${String(Math.floor(Math.random() * 10 ** 9)).padStart(9, "0")}`,
  };

  // simulate unique device fingerprint (user-agent + accept-language + ip)
  const randOctet = () => Math.floor(Math.random() * 250) + 1;
  const headers = {
    "user-agent": `loadtest-agent/${iteration}.${vu}`,
    "accept-language": `en-US,en;q=0.${(vu % 9) + 1}`,
    // requires backend `app.set("trust proxy", 1)` so `req.ip` uses this header
    "x-forwarded-for": `10.${randOctet()}.${randOctet()}.${randOctet()}`,
  };

  await httpJsonWithHeaders("POST", `${API}/qr/scan`, { token }, headers);
  await httpJsonWithHeaders("POST", `${API}/votes/submit-info`, { token, ...voter }, headers);
  await httpJsonWithHeaders(
    "POST",
    `${API}/votes/submit-final`,
    { token, stars: STARS, ...voter },
    headers,
  );
}

async function pool(items, concurrency, worker) {
  let i = 0;
  const results = { ok: 0, fail: 0, errors: [] };

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        await worker(items[idx]);
        results.ok++;
      } catch (e) {
        results.fail++;
        if (results.errors.length < 20) {
          results.errors.push({
            message: e?.message,
            status: e?.status,
            body: e?.body,
          });
        }
      }
    }
  });

  await Promise.all(runners);
  return results;
}

async function main() {
  assertEnv();

  console.log("Load test config:", {
    API,
    CONTEST_ID,
    SEASON_ID,
    ROUND_ID,
    PARTICIPANT_ID,
    VUS,
    ITERATIONS,
    CONCURRENCY,
    STARS,
  });

  const token = await generateToken();
  console.log("Using token:", token.slice(0, 16) + "...");

  const scenarios = [];
  for (let it = 1; it <= ITERATIONS; it++) {
    for (let vu = 1; vu <= VUS; vu++) scenarios.push({ token, vu, iteration: it });
  }

  const start = Date.now();
  const res = await pool(scenarios, CONCURRENCY, runAudienceFlow);
  const elapsedMs = Date.now() - start;

  console.log("DONE", {
    total: scenarios.length,
    ok: res.ok,
    fail: res.fail,
    elapsedMs,
    rps: Number((scenarios.length / (elapsedMs / 1000)).toFixed(2)),
    sampleErrors: res.errors,
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

