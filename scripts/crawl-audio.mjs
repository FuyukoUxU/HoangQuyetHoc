import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = process.cwd();
const QUIZZES_DIR = path.join(ROOT, "data", "quizzes");
const AUDIO_DIR = path.join(ROOT, "data", "audio");
const STATUS_PATH = path.join(ROOT, "data", "audio-status.json");
const CONCURRENCY = Number(process.env.AUDIO_CONCURRENCY || 8);

fs.mkdirSync(AUDIO_DIR, { recursive: true });

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractUuid(val) {
  if (typeof val !== "string") return null;
  const m = val.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}

function collectAudioIds() {
  const listeningIds = new Set();
  const speakingIds = new Set();

  function scan(obj, isSpeaking) {
    if (!obj || typeof obj !== "object") return;
    for (const k of ["listening", "instruction_audio", "file_id"]) {
      const id = extractUuid(obj[k]);
      if (id) listeningIds.add(id);
    }
    const audioId = extractUuid(obj.audio_url);
    if (audioId) {
      if (isSpeaking) speakingIds.add(audioId);
      else listeningIds.add(audioId);
    }
    if (Array.isArray(obj.parts)) obj.parts.forEach((p) => scan(p, isSpeaking));
    if (Array.isArray(obj.questions)) obj.questions.forEach((q) => scan(q, isSpeaking));
    if (Array.isArray(obj.question_sets)) obj.question_sets.forEach((qs) => scan(qs, isSpeaking));
  }

  for (const f of fs.readdirSync(QUIZZES_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(QUIZZES_DIR, f), "utf8"));
      scan(data, data.type === 8 || data.questions?.[0]?.type === "speaking");
    } catch {}
  }

  // Deduplicate while prioritizing Listening tracks first, then Speaking clips
  const ordered = [...listeningIds];
  for (const id of speakingIds) {
    if (!listeningIds.has(id)) ordered.push(id);
  }
  return {
    ordered,
    listeningCount: listeningIds.size,
    speakingCount: ordered.length - listeningIds.size,
  };
}

function writeStatus(obj) {
  fs.writeFileSync(
    STATUS_PATH,
    JSON.stringify({ ...obj, updatedAt: new Date().toISOString() }, null, 2)
  );
}

async function downloadOne(id, attempt = 1) {
  const outPath = path.join(AUDIO_DIR, `${id}.mp3`);
  const tmpPath = `${outPath}.tmp`;

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    return { skipped: true, bytes: fs.statSync(outPath).size };
  }

  const url = `https://cms.youpass.vn/assets/${id}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt <= 5) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        return downloadOne(id, attempt + 1);
      }
    }
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("audio") && !ct.includes("octet-stream") && !ct.includes("video")) {
      await res.body.cancel();
      throw new Error(`Non-audio content-type: ${ct}`);
    }

    const fileStream = fs.createWriteStream(tmpPath);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    const size = fs.statSync(tmpPath).size;
    if (size === 0) {
      fs.unlinkSync(tmpPath);
      throw new Error("Empty file");
    }
    fs.renameSync(tmpPath, outPath);
    return { skipped: false, bytes: size };
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    if (attempt < 3 && !String(err.message).includes("HTTP 404")) {
      await new Promise((r) => setTimeout(r, 800 * attempt));
      return downloadOne(id, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const { ordered, listeningCount, speakingCount } = collectAudioIds();
  console.log(
    `[audio] Found ${ordered.length} unique audio files (${listeningCount} Listening + ${speakingCount} Speaking).`
  );

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;
  const failedIds = [];

  writeStatus({
    state: "downloading",
    startedAt,
    total: ordered.length,
    listeningCount,
    speakingCount,
    completed: 0,
    skipped: 0,
    failed: 0,
    totalBytes: 0,
  });

  let cursor = 0;
  let lastFlush = Date.now();

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= ordered.length) break;
      const id = ordered[idx];
      try {
        const res = await downloadOne(id);
        completed += 1;
        totalBytes += res.bytes;
        if (res.skipped) skipped += 1;
      } catch (err) {
        failed += 1;
        failedIds.push({ id, err: err.message });
        if (failed <= 10) console.warn(`[audio warn] ${id}: ${err.message}`);
      }

      const now = Date.now();
      if (now - lastFlush > 1500) {
        lastFlush = now;
        const mb = (totalBytes / 1024 / 1024).toFixed(1);
        const pct = ((completed / ordered.length) * 100).toFixed(1);
        console.log(
          `[audio] ${completed}/${ordered.length} (${pct}%) | ${mb} MB | skipped=${skipped} failed=${failed}`
        );
        writeStatus({
          state: "downloading",
          startedAt,
          total: ordered.length,
          listeningCount,
          speakingCount,
          completed,
          skipped,
          failed,
          totalBytes,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  writeStatus({
    state: "done",
    startedAt,
    finishedAt: new Date().toISOString(),
    total: ordered.length,
    listeningCount,
    speakingCount,
    completed,
    skipped,
    failed,
    totalBytes,
    failedIds: failedIds.slice(0, 30),
  });
  console.log(
    `[audio done] Saved ${completed}/${ordered.length} audio files (${mb} MB, skipped=${skipped}, failed=${failed}).`
  );
}

main().catch((err) => {
  console.error("[audio fatal]", err);
  writeStatus({ state: "error", error: err.message });
  process.exit(1);
});
