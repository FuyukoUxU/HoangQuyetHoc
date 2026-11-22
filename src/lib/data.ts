import fs from "node:fs";
import path from "node:path";
import type { CatalogData } from "./ielts";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const STATUS_PATH = path.join(DATA_DIR, "crawl-status.json");
const AUDIO_STATUS_PATH = path.join(DATA_DIR, "audio-status.json");
const AUTH_PATH = path.join(DATA_DIR, "auth.json");
const QUIZZES_DIR = path.join(DATA_DIR, "quizzes");
const AUDIO_DIR = path.join(DATA_DIR, "audio");

export function getCatalog(): CatalogData | null {
  try {
    if (!fs.existsSync(CATALOG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as CatalogData;
  } catch {
    return null;
  }
}

export function getCrawlStatus() {
  let status: Record<string, unknown> = { state: "idle" };
  try {
    if (fs.existsSync(STATUS_PATH)) {
      status = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
    }
  } catch {}

  let downloadedFiles = 0;
  try {
    if (fs.existsSync(QUIZZES_DIR)) {
      downloadedFiles = fs.readdirSync(QUIZZES_DIR).filter((f) => f.endsWith(".json")).length;
    }
  } catch {}

  let downloadedAudio = 0;
  try {
    if (fs.existsSync(AUDIO_DIR)) {
      downloadedAudio = fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith(".mp3")).length;
    }
  } catch {}

  let audioStatus: Record<string, unknown> = { state: "idle", total: 0, totalBytes: 0 };
  try {
    if (fs.existsSync(AUDIO_STATUS_PATH)) {
      audioStatus = JSON.parse(fs.readFileSync(AUDIO_STATUS_PATH, "utf8"));
    }
  } catch {}

  const catalog = getCatalog();
  const rawTotal = catalog?.counts?.uniqueQuizPayloads || (status.totalQuizzes as number) || 0;
  const effectiveTotal =
    status.state === "done" && downloadedFiles > 0 ? downloadedFiles : rawTotal;
  const rawAudioTotal = (audioStatus.total as number) || 0;
  const effectiveAudioTotal =
    audioStatus.state === "done" && downloadedAudio > 0 ? downloadedAudio : rawAudioTotal;

  return {
    ...status,
    downloadedFiles,
    totalQuizzes: effectiveTotal,
    audio: {
      state: String(audioStatus.state || "idle"),
      downloaded: downloadedAudio,
      total: effectiveAudioTotal,
      totalBytes: Number(audioStatus.totalBytes || 0),
    },
    account: catalog?.account || null,
    crawledAt: catalog?.crawledAt || null,
    counts: catalog?.counts
      ? { ...catalog.counts, uniqueQuizPayloads: effectiveTotal }
      : null,
  };
}

export async function getQuizById(id: string | number): Promise<Record<string, any> | null> {
  const safeId = String(id).replace(/[^0-9]/g, "");
  if (!safeId) return null;
  const filePath = path.join(QUIZZES_DIR, `${safeId}.json`);

  let cached: Record<string, any> | null = null;
  if (fs.existsSync(filePath)) {
    try {
      cached = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {}
  }

  const needsVocabsPassages =
    cached &&
    (cached.type === 9 || cached.type === 10) &&
    Array.isArray(cached.parts) &&
    cached.parts.some(
      (p: any) =>
        (!p.content || String(p.content).length < 250) &&
        (!Array.isArray(p.vocabs) || p.vocabs.length === 0)
    );

  if (cached && !needsVocabsPassages) {
    return cached;
  }

  // Live fetch (or v2 passage hydration with included_vocabs=true) + local cache
  try {
    if (!fs.existsSync(AUTH_PATH)) return cached;
    const cookies = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
    const map = Object.fromEntries((cookies || []).map((c: any) => [c.name, c.value]));
    const token = map.auth_token || map.access_token || "";
    const cookieHeader = (cookies || []).map((c: any) => `${c.name}=${c.value}`).join("; ");
    const res = await fetch(
      `https://api.youpass.vn/v1/quizzes/${safeId}?included_vocabs=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: cookieHeader,
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return cached;
    const json = await res.json();
    if (json?.data) {
      fs.mkdirSync(QUIZZES_DIR, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(json.data));
      return json.data;
    }
  } catch {}
  return cached;
}
