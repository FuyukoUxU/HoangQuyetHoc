import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const catalogPath = path.join(process.cwd(), "data", "catalog.json");
assert.ok(fs.existsSync(catalogPath), "catalog.json must exist");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const c = catalog.counts;

assert.equal(c.reading, catalog.reading.length, "reading count reconciles");
assert.equal(c.listening, catalog.listening.length, "listening count reconciles");
assert.equal(c.writingTotal, catalog.writing.task1.length + catalog.writing.task2.length, "writing count reconciles");
assert.equal(
  c.speakingTopicsTotal,
  catalog.speaking.part1.length + catalog.speaking.part2.length + catalog.speaking.part3.length,
  "speaking topic count reconciles"
);
assert.ok(c.uniqueQuizPayloads > 5000, "full bank has >5000 unique quiz payloads");

// Gap-fill parser check
const sample = "Work location: {[Jamieson][1]}Island; Date: {[11 July | July 11][2]}";
const matches = [...sample.matchAll(/\{\[([^\]]+)\]\[(\d+)\]\}/g)];
assert.equal(matches.length, 2, "parses two blanks");
assert.equal(matches[1][2], "2", "extracts blank number 2");
assert.deepEqual(
  matches[1][1].split("|").map((s) => s.trim()),
  ["11 July", "July 11"],
  "extracts multiple accepted answers"
);

const downloaded = fs.readdirSync(path.join(process.cwd(), "data", "quizzes")).length;
const q13910 = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "quizzes", "13910.json"), "utf8"));
assert.ok(q13910.parts[0].question_sets.length > 0, "v2 quiz 13910 has question_sets");
console.log(`[verify] OK — catalog=${c.uniqueQuizPayloads} payloads, downloaded=${downloaded} files so far.`);
