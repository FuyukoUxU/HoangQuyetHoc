import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const QUIZZES_DIR = path.join(DATA_DIR, "quizzes");
const AUTH_PATH = path.join(DATA_DIR, "auth.json");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const STATUS_PATH = path.join(DATA_DIR, "crawl-status.json");

const API_BASE = "https://api.youpass.vn";
// api.youpass.vn enforces ~400 req / 60s window; 6 req/s + 429 pause downloads 100% with zero drops
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY || 4);
const MIN_INTERVAL_MS = Number(process.env.CRAWL_INTERVAL_MS || 160);
const FORCE = process.argv.includes("--force");
const REFRESH_CATALOG = process.argv.includes("--refresh-catalog");

let nextAllowedTime = 0;
let rateLimitPauseUntil = 0;

async function paceRequest() {
  const now = Date.now();
  if (rateLimitPauseUntil > now) {
    await new Promise((r) => setTimeout(r, rateLimitPauseUntil - now));
  }
  const wait = Math.max(0, nextAllowedTime - Date.now());
  nextAllowedTime = Math.max(Date.now(), nextAllowedTime) + MIN_INTERVAL_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

fs.mkdirSync(QUIZZES_DIR, { recursive: true });

function loadAuth() {
  const raw = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  const cookies = Array.isArray(raw) ? raw : raw.cookies || [];
  const map = Object.fromEntries(cookies.map((c) => [c.name, c.value]));
  return {
    cookies,
    token: map.auth_token || map.access_token || "",
    deviceId: map.device_id || "ecf6cf4a294f7f4f2677b80918651a76",
    cookieHeader: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}

let auth = loadAuth();
let refreshPromise = null;

async function refreshToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        Cookie: auth.cookieHeader,
        "X-Device-ID": auth.deviceId,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Refresh token failed: HTTP ${res.status}`);
    const json = await res.json();
    const payload = json?.data?.data || json?.data || {};
    const nextToken = payload.access_token || payload.token;
    if (!nextToken) throw new Error("Refresh response missing token");
    const updated = auth.cookies.map((c) => {
      if (c.name === "auth_token" || c.name === "access_token") return { ...c, value: nextToken };
      if (c.name === "directus_refresh_token" && payload.refresh_token) return { ...c, value: payload.refresh_token };
      return c;
    });
    fs.writeFileSync(AUTH_PATH, JSON.stringify(updated, null, 2));
    auth = loadAuth();
    console.log("[auth] Refreshed access token.");
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function apiGet(urlPath, attempt = 1) {
  await paceRequest();
  const res = await fetch(`${API_BASE}${urlPath}`, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Cookie: auth.cookieHeader,
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (res.status === 401 && attempt === 1) {
    await refreshToken();
    return apiGet(urlPath, attempt + 1);
  }
  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("retry-after")) || 12;
    rateLimitPauseUntil = Math.max(rateLimitPauseUntil, Date.now() + retryAfterSec * 1000);
    if (attempt <= 12) {
      return apiGet(urlPath, attempt + 1);
    }
  }
  if (!res.ok) {
    if (attempt < 4 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return apiGet(urlPath, attempt + 1);
    }
    throw new Error(`GET ${urlPath} -> HTTP ${res.status}`);
  }
  return res.json();
}

function writeStatus(patch) {
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
  } catch {}
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(next, null, 2));
}

async function fetchPaginatedQuizzes(label, baseQuery) {
  const pageSize = 100;
  let page = 1;
  const all = [];
  while (true) {
    const json = await apiGet(`/v1/quizzes?page_size=${pageSize}&page=${page}&${baseQuery}`);
    const data = json?.data || {};
    const items = data.items || [];
    all.push(...items);
    const total = data.total || 0;
    console.log(`[catalog] ${label}: page ${page} (${all.length}/${total})`);
    if (!items.length || all.length >= total) break;
    page += 1;
  }
  return all;
}

async function fetchSpeakingTopics(part) {
  const pageSize = 100;
  let page = 1;
  const topics = [];
  while (true) {
    const json = await apiGet(
      `/v1/speaking-topics?page_size=${pageSize}&page=${page}&status=published&speaking_part_type=${part}`
    );
    const data = json?.data || {};
    const batch = data.topics || [];
    topics.push(...batch);
    const total = data.total || 0;
    console.log(`[catalog] speaking part ${part}: page ${page} (${topics.length}/${total})`);
    if (!batch.length || topics.length >= total) break;
    page += 1;
  }
  return topics;
}

async function fetchMockTests(skillId) {
  const json = await apiGet(`/v1/mock-test?null=null&page_size=100&page=1&skill_id=${skillId}&sort=priority.desc`);
  const books = json?.data?.items || [];
  const enrichedBooks = [];
  for (const book of books) {
    const tests = [];
    for (const mt of book.mock_tests || []) {
      try {
        const detail = (await apiGet(`/v1/mock-test/${mt.id}`))?.data || mt;
        tests.push({ ...mt, quizzes: detail.quizzes || {} });
      } catch {
        tests.push(mt);
      }
    }
    enrichedBooks.push({ ...book, mock_tests: tests });
  }
  console.log(`[catalog] mock-tests skill=${skillId}: ${enrichedBooks.length} books`);
  return enrichedBooks;
}

function slimQuizItem(item, skill, subType = null) {
  return {
    id: item.id,
    type: item.type,
    skill,
    subType,
    title: (item.title || "").trim(),
    time: item.time || null,
    thumbnail: item.thumbnail || null,
    slug: item.slug || null,
    simplified_id: item.simplified_id || null,
    tags: (item.tags || []).map((t) => ({ id: t.id, title: t.title, code: t.code })),
    date_created: item.date_created || null,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  let catalog = null;

  if (!REFRESH_CATALOG && fs.existsSync(CATALOG_PATH)) {
    try {
      catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
      console.log("[catalog] Loaded cached catalog.json:", catalog.counts);
    } catch {}
  }

  if (!catalog) {
    writeStatus({ state: "indexing", startedAt, error: null });
    const meRes = await apiGet("/v1/users/me");
    const user = meRes?.data || {};
    console.log(`[auth] Logged in as: ${user.fullname || user.first_name || user.email} (${user.email})`);

    const tagRes = await apiGet("/v1/tag-positions?fields=*,tags.*,tags.tag_search_id.*");
    const tagPositions = tagRes?.data || [];

    const [readingRaw, listeningRaw, writingT1Raw, writingT2Raw, sp1, sp2, sp3, mockReading, mockListening, mockSpeaking] =
      await Promise.all([
        fetchPaginatedQuizzes(
          "reading",
          "types=1&types=9&status=published&is_test=true&quiz_types=3&isLogin=true&submitted_status=2&sort=practice_listing_priority.desc,simplified_id.asc"
        ),
        fetchPaginatedQuizzes(
          "listening",
          "types=2&types=10&status=published&is_test=true&quiz_types=3&isLogin=true&submitted_status=2&sort=practice_listing_priority.desc,date_created.desc"
        ),
        fetchPaginatedQuizzes(
          "writing-task-1",
          "types=7&writing_task_type=1&status=published&is_test=true&quiz_types=3&isLogin=true&submitted_status=2&sort=practice_listing_priority.desc,date_created.desc"
        ),
        fetchPaginatedQuizzes(
          "writing-task-2",
          "types=7&writing_task_type=2&status=published&is_test=true&quiz_types=3&isLogin=true&submitted_status=2&sort=practice_listing_priority.desc,date_created.desc"
        ),
        fetchSpeakingTopics(1),
        fetchSpeakingTopics(2),
        fetchSpeakingTopics(3),
        fetchMockTests(1),
        fetchMockTests(2),
        fetchMockTests(8),
      ]);

    const reading = readingRaw.map((x) => slimQuizItem(x, "reading"));
    const listening = listeningRaw.map((x) => slimQuizItem(x, "listening"));
    const writingTask1 = writingT1Raw.map((x) => slimQuizItem(x, "writing", "task-1"));
    const writingTask2 = writingT2Raw.map((x) => slimQuizItem(x, "writing", "task-2"));

    const formatTopic = (t, part) => ({
      id: t.id,
      part,
      title: (t.title || "").trim(),
      thumbnail: t.thumbnail || null,
      tags: (t.tags || []).map((tg) => ({ id: tg.id, title: tg.title, code: tg.code })),
      quizzes: (t.quizzes || []).map((q) => ({
        id: q.id,
        title: (q.title || "").trim(),
        sort: q.sort || 0,
      })),
    });

    const speaking = {
      part1: sp1.map((t) => formatTopic(t, 1)),
      part2: sp2.map((t) => formatTopic(t, 2)),
      part3: sp3.map((t) => formatTopic(t, 3)),
    };

    const countMockTests = (books) => books.reduce((s, b) => s + (b.mock_tests?.length || 0), 0);
    const countSpeakingQuizzes = (topics) => topics.reduce((s, t) => s + (t.quizzes?.length || 0), 0);

    const tmpIds = new Set();
    for (const list of [reading, listening, writingTask1, writingTask2]) {
      for (const item of list) {
        if (item.id) tmpIds.add(item.id);
        if (item.simplified_id) tmpIds.add(item.simplified_id);
      }
    }
    for (const books of [mockReading, mockListening, mockSpeaking]) {
      for (const book of books) {
        for (const mt of book.mock_tests || []) {
          for (const qObj of Object.values(mt.quizzes || {})) {
            if (qObj && typeof qObj === "object" && qObj.id) tmpIds.add(qObj.id);
          }
        }
      }
    }
    for (const list of [speaking.part1, speaking.part2, speaking.part3]) {
      for (const topic of list) {
        for (const q of topic.quizzes) {
          if (q.id) tmpIds.add(q.id);
        }
      }
    }

    catalog = {
      crawledAt: new Date().toISOString(),
      account: { email: user.email, name: user.fullname || user.first_name || "" },
      counts: {
        reading: reading.length,
        listening: listening.length,
        writingTask1: writingTask1.length,
        writingTask2: writingTask2.length,
        writingTotal: writingTask1.length + writingTask2.length,
        speakingTopicsPart1: speaking.part1.length,
        speakingTopicsPart2: speaking.part2.length,
        speakingTopicsPart3: speaking.part3.length,
        speakingTopicsTotal: speaking.part1.length + speaking.part2.length + speaking.part3.length,
        speakingQuestionsTotal:
          countSpeakingQuizzes(speaking.part1) +
          countSpeakingQuizzes(speaking.part2) +
          countSpeakingQuizzes(speaking.part3),
        mockReading: countMockTests(mockReading),
        mockListening: countMockTests(mockListening),
        mockSpeaking: countMockTests(mockSpeaking),
        mockTotal: countMockTests(mockReading) + countMockTests(mockListening) + countMockTests(mockSpeaking),
        uniqueQuizPayloads: tmpIds.size,
      },
      tagPositions,
      reading,
      listening,
      writing: {
        task1: writingTask1,
        task2: writingTask2,
      },
      speaking,
      mockTests: {
        reading: mockReading,
        listening: mockListening,
        speaking: mockSpeaking,
      },
    };

    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog));
    console.log("[catalog] Saved catalog.json:", catalog.counts);
  }

  // Prioritize Reading, Listening, Writing, and Full Mock Tests first, then Speaking questions
  const quizIds = new Set();
  for (const list of [catalog.reading, catalog.listening, catalog.writing.task1, catalog.writing.task2]) {
    for (const item of list || []) {
      if (item.id) quizIds.add(item.id);
      if (item.simplified_id) quizIds.add(item.simplified_id);
    }
  }
  for (const books of [catalog.mockTests.reading, catalog.mockTests.listening, catalog.mockTests.speaking]) {
    for (const book of books || []) {
      for (const mt of book.mock_tests || []) {
        for (const qObj of Object.values(mt.quizzes || {})) {
          if (qObj && typeof qObj === "object" && qObj.id) quizIds.add(qObj.id);
        }
      }
    }
  }
  for (const list of [catalog.speaking.part1, catalog.speaking.part2, catalog.speaking.part3]) {
    for (const topic of list || []) {
      for (const q of topic.quizzes || []) {
        if (q.id) quizIds.add(q.id);
      }
    }
  }

  const allIds = [...quizIds];
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds = [];

  writeStatus({
    state: "downloading",
    startedAt,
    totalQuizzes: allIds.length,
    completed: 0,
    skipped: 0,
    failed: 0,
    counts: catalog.counts,
  });

  let cursor = 0;
  let lastStatusFlush = Date.now();

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= allIds.length) break;
      const id = allIds[idx];
      const outFile = path.join(QUIZZES_DIR, `${id}.json`);
      if (!FORCE && fs.existsSync(outFile)) {
        skipped += 1;
        completed += 1;
        continue;
      }
      try {
        const res = await apiGet(`/v1/quizzes/${id}?included_vocabs=true`);
        if (res?.data) {
          fs.writeFileSync(outFile, JSON.stringify(res.data));
          completed += 1;
        } else {
          failed += 1;
          failedIds.push(id);
        }
      } catch (err) {
        failed += 1;
        failedIds.push(id);
        if (failed <= 10) console.warn(`[warn] quiz ${id}: ${err.message}`);
      }

      const now = Date.now();
      if (now - lastStatusFlush > 1500) {
        lastStatusFlush = now;
        const pct = ((completed / allIds.length) * 100).toFixed(1);
        console.log(`[quizzes] ${completed}/${allIds.length} (${pct}%) | skipped=${skipped} failed=${failed}`);
        writeStatus({
          state: "downloading",
          totalQuizzes: allIds.length,
          completed,
          skipped,
          failed,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  writeStatus({
    state: "done",
    finishedAt: new Date().toISOString(),
    totalQuizzes: allIds.length,
    completed,
    skipped,
    failed,
    failedIds: failedIds.slice(0, 50),
    counts: catalog.counts,
  });

  console.log(`[done] Crawled ${completed}/${allIds.length} quizzes (skipped=${skipped}, failed=${failed}).`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  writeStatus({ state: "error", error: err.message });
  process.exit(1);
});
