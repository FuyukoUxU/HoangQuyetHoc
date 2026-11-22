export interface TagItem {
  id: number;
  title: string;
  code: string;
}

export interface CatalogQuizItem {
  id: number;
  type: number;
  skill: "reading" | "listening" | "writing";
  subType?: string | null;
  title: string;
  time: number | null;
  thumbnail: string | null;
  slug: string | null;
  simplified_id: number | null;
  tags: TagItem[];
  date_created: string | null;
}

export interface SpeakingTopicItem {
  id: number;
  part: number;
  title: string;
  thumbnail: string | null;
  tags: TagItem[];
  quizzes: { id: number; title: string; sort: number }[];
}

export interface MockTestBook {
  title: string;
  mock_tests: {
    id: number;
    title: string;
    thumbnail: string | null;
    book_code: string;
    skill_id: number;
    quizzes?: Record<string, { id: number; time: number; question_count: number }>;
  }[];
}

export interface CatalogData {
  crawledAt: string;
  account: { email: string; name: string };
  counts: {
    reading: number;
    listening: number;
    writingTask1: number;
    writingTask2: number;
    writingTotal: number;
    speakingTopicsPart1: number;
    speakingTopicsPart2: number;
    speakingTopicsPart3: number;
    speakingTopicsTotal: number;
    speakingQuestionsTotal: number;
    mockReading: number;
    mockListening: number;
    mockSpeaking: number;
    mockTotal: number;
    uniqueQuizPayloads: number;
  };
  reading: CatalogQuizItem[];
  listening: CatalogQuizItem[];
  writing: {
    task1: CatalogQuizItem[];
    task2: CatalogQuizItem[];
  };
  speaking: {
    part1: SpeakingTopicItem[];
    part2: SpeakingTopicItem[];
    part3: SpeakingTopicItem[];
  };
  mockTests: {
    reading: MockTestBook[];
    listening: MockTestBook[];
    speaking: MockTestBook[];
  };
}

export function assetUrl(uuidOrUrl?: string | null): string | null {
  if (!uuidOrUrl) return null;
  if (uuidOrUrl.startsWith("http://") || uuidOrUrl.startsWith("https://")) return uuidOrUrl;
  return `https://cms.youpass.vn/assets/${uuidOrUrl}`;
}

const AUDIO_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Resolves any Listening or Speaking audio reference to the local offline route `/api/audio/<uuid>`.
 */
export function audioAssetUrl(uuidOrUrl?: string | null): string | null {
  if (!uuidOrUrl) return null;
  const m = String(uuidOrUrl).match(AUDIO_UUID_RE);
  if (m) return `/api/audio/${m[0].toLowerCase()}`;
  return assetUrl(uuidOrUrl);
}

/**
 * Official IELTS Reading/Listening 40-question raw score -> Band Score (Academic)
 * Scales proportionally when practicing a single passage/section (e.g. 10 or 13 questions).
 */
export function calculateIeltsBand(correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0;
  const scaled40 = Math.round((correct / total) * 40);
  if (scaled40 >= 39) return 9.0;
  if (scaled40 >= 37) return 8.5;
  if (scaled40 >= 35) return 8.0;
  if (scaled40 >= 33) return 7.5;
  if (scaled40 >= 30) return 7.0;
  if (scaled40 >= 27) return 6.5;
  if (scaled40 >= 23) return 6.0;
  if (scaled40 >= 19) return 5.5;
  if (scaled40 >= 15) return 5.0;
  if (scaled40 >= 13) return 4.5;
  if (scaled40 >= 10) return 4.0;
  if (scaled40 >= 8) return 3.5;
  if (scaled40 >= 6) return 3.0;
  return 2.5;
}

export interface BlankToken {
  kind: "html" | "blank";
  value: string;
  blankNumber?: number;
  acceptedAnswers?: string[];
}

/**
 * Parses YouPass gap-fill syntax `{[answer1 | answer2][number]}` into alternating HTML & blank descriptors.
 */
export function parseGapFillHtml(html: string): BlankToken[] {
  if (!html) return [];
  const regex = /\{\[([^\]]+)\]\[(\d+)\]\}/g;
  const tokens: BlankToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "html", value: html.slice(lastIndex, match.index) });
    }
    const rawAnswers = match[1]
      .split("|")
      .map((s) => s.replace(/&nbsp;/g, " ").trim())
      .filter(Boolean);
    tokens.push({
      kind: "blank",
      value: match[0],
      blankNumber: Number(match[2]),
      acceptedAnswers: rawAnswers,
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < html.length) {
    tokens.push({ kind: "html", value: html.slice(lastIndex) });
  }
  return tokens;
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBlankCorrect(userInput: string, accepted: string[]): boolean {
  const norm = normalizeAnswer(userInput);
  if (!norm) return false;
  return accepted.some((ans) => normalizeAnswer(ans) === norm);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Cleans `{[sentence][qNum]}` passage locate markers.
 * Hides empty `{[ ][7]}` markers; highlights evidence sentences after submission.
 */
export function formatPassageHtml(rawHtml: string, submitted: boolean): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/\{\[([\s\S]*?)\]\[([\d,\s-]+)\]\}/g, (_m, inner: string, qNum: string) => {
      const clean = inner.replace(/&nbsp;/g, " ").trim();
      if (!clean) return "";
      if (!submitted || inner.includes("</p>") || inner.includes("<p")) return inner;
      return `<mark style="background:#fff3bf;padding:1px 4px;border-radius:3px;"><strong>[${qNum}]</strong> ${inner}</mark>`;
    })
    .replace(/\]\[[\d,\s-]+\]\}/g, "")
    .replace(/\{\[/g, "");
}

/**
 * Reconstructs passage HTML when v2 quizzes (type=9) store paragraphs in `part.vocabs`.
 */
export function extractPartPassage(part: Record<string, any>, useSimplified: boolean, submitted: boolean): string {
  if (useSimplified && part?.simplified_content) {
    return formatPassageHtml(part.simplified_content, submitted);
  }
  const rawContent = part?.content && part.content !== "null" ? String(part.content) : "";
  const vocabs = Array.isArray(part?.vocabs) ? part.vocabs : [];

  if (rawContent.length < 260 && vocabs.length > 0) {
    const paragraphs = vocabs
      .map((para: any) => {
        if (Array.isArray(para.children) && para.children.length > 0) {
          const text = para.children
            .map((s: any) => String(s.value || "").trim())
            .filter(Boolean)
            .join(" ");
          return text ? `<p>${text}</p>` : "";
        }
        return para.value ? `<p>${para.value}</p>` : "";
      })
      .filter(Boolean)
      .join("\n");
    return formatPassageHtml(`${rawContent}\n${paragraphs}`, submitted);
  }

  const fallback =
    rawContent ||
    (part?.transcription && part.transcription !== "null" ? String(part.transcription) : "");
  return formatPassageHtml(fallback, submitted);
}

/**
 * Normalizes YouPass v2 `part.question_sets` into standard `part.questions` items.
 */
export function normalizePartQuestions(part: Record<string, any>): any[] {
  if (Array.isArray(part?.questions) && part.questions.length > 0) {
    return part.questions;
  }
  const sets: any[] = Array.isArray(part?.question_sets) ? part.question_sets : [];
  if (sets.length === 0) return [];

  const out: any[] = [];
  for (const qs of sets) {
    const qsQuestions: any[] = Array.isArray(qs.questions) ? qs.questions : [];
    if (qsQuestions.length === 0) continue;

    const qType = String(qs.question_type || "");
    const headerHtml = [
      qs.title ? `<h3>${qs.title}</h3>` : "",
      qs.description || "",
    ]
      .filter(Boolean)
      .join("\n");

    const combinedExplain = qsQuestions
      .map((q, idx) =>
        q.explain ? `<div style="margin-bottom:10px;"><strong>Câu ${q.order || idx + 1}:</strong>${q.explain}</div>` : ""
      )
      .filter(Boolean)
      .join("");

    if (qType === "GAP_FILLING") {
      let gapHtml = String(qs.content || "");
      if (gapHtml.includes("gap-placeholder")) {
        let qCursor = 0;
        gapHtml = gapHtml.replace(
          /<span[^>]*class=["'][^"']*gap-placeholder[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
          () => {
            const q = qsQuestions[qCursor++] || {};
            const ansList: string[] = Array.isArray(q.correct_answers) && q.correct_answers.length
              ? q.correct_answers
              : q.correct_answer
              ? [q.correct_answer]
              : [""];
            return `{[${ansList.join(" | ")}][${q.order || qCursor}]}`;
          }
        );
      } else {
        gapHtml = qsQuestions
          .map((q, idx) => {
            const ansList: string[] = Array.isArray(q.correct_answers) && q.correct_answers.length
              ? q.correct_answers
              : q.correct_answer
              ? [q.correct_answer]
              : [""];
            const token = `{[${ansList.join(" | ")}][${q.order || idx + 1}]}`;
            const txt = String(q.text || "");
            return `<p>${
              txt.match(/_{2,}|\.{4,}/) ? txt.replace(/_{2,}|\.{4,}/, token) : `${txt} ${token}`
            }</p>`;
          })
          .join("\n");
      }

      out.push({
        id: `qs_${qs.id}`,
        type: "FILL-IN-THE-BLANK",
        description: headerHtml,
        title: "",
        gap_fill_in_blank: gapHtml,
        explain: combinedExplain,
      });
      continue;
    }

    if (qType === "SINGLE_CHOICE") {
      qsQuestions.forEach((q, idx) => {
        const opts: any[] = Array.isArray(q.options) ? q.options : [];
        out.push({
          id: q.id || `qs_${qs.id}_${idx}`,
          type: "SINGLE-RADIO",
          description: idx === 0 ? headerHtml : null,
          title: q.text || q.title || "",
          single_choice_radio: opts.map((o) => ({
            text: o.text || o.option || "",
            correct: Boolean(o.is_correct || o.option === q.correct_answer),
          })),
          explain: q.explain || "",
        });
      });
      continue;
    }

    if (qType === "MULTIPLE_CHOICE_MANY") {
      qsQuestions.forEach((q, idx) => {
        const opts: any[] = Array.isArray(q.options) ? q.options : [];
        const corr: string[] = Array.isArray(q.correct_answers) ? q.correct_answers : [];
        out.push({
          id: q.id || `qs_${qs.id}_${idx}`,
          type: "MULTIPLE",
          description: idx === 0 ? headerHtml : null,
          title: q.text || q.title || headerHtml,
          mutilple_choice: opts.map((o, oIdx) => ({
            text: o.text || o.option || "",
            correct: Boolean(o.is_correct || corr.includes(o.option)),
            order: oIdx + 1,
          })),
          explain: q.explain || "",
        });
      });
      continue;
    }

    // SINGLE_SELECTION, MATCHING_HEADINGS, MATCHING_FEATURES, MATCHING_ENDINGS, TABLE_SELECTION, NOTE_COMPLETION
    const rawOpts: any[] =
      Array.isArray(qs.options) && qs.options.length > 0
        ? qs.options
        : Array.isArray(qsQuestions[0]?.options)
        ? qsQuestions[0].options
        : [];

    const hasVerboseLegend = rawOpts.some(
      (o) => o.text && o.option && String(o.text).trim() !== String(o.option).trim()
    );
    const legendHtml = hasVerboseLegend
      ? `<div style="padding:10px 12px;background:var(--ground);border:1px solid var(--border);border-radius:6px;margin-top:8px;">` +
        (qs.option_title ? `<p><strong>${qs.option_title}</strong></p>` : "") +
        rawOpts
          .map((o) => {
            const label = String(o.text || "");
            const prefix = label.startsWith(`${o.option}.`) ? "" : `<strong>${o.option}.</strong> `;
            return `<p style="margin-bottom:4px;">${prefix}${label}</p>`;
          })
          .join("") +
        `</div>`
      : "";

    let contextBox = "";
    if (qs.content) {
      let idxCounter = 0;
      contextBox = String(qs.content).replace(
        /<span[^>]*class=["'][^"']*gap-placeholder[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
        () => {
          const q = qsQuestions[idxCounter++];
          return `<strong>[${q?.order || idxCounter}] ______</strong>`;
        }
      );
    }

    out.push({
      id: `qs_${qs.id}`,
      type: "SINGLE-SELECTION",
      description: [headerHtml, legendHtml, contextBox].filter(Boolean).join("\n"),
      selection: qsQuestions.map((q) => ({
        text: q.text || q.title || `Question ${q.order || ""}`,
        answer: String(q.correct_answer || (q.correct_answers?.[0] ?? "")).trim(),
      })),
      selection_option: rawOpts.map((o) => ({ option: String(o.option || o.text) })),
      explain: combinedExplain,
    });
  }

  return out;
}
