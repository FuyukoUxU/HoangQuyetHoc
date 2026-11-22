"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  assetUrl,
  audioAssetUrl,
  calculateIeltsBand,
  countWords,
  extractPartPassage,
  formatPassageHtml,
  isBlankCorrect,
  normalizePartQuestions,
  parseGapFillHtml,
} from "@/lib/ielts";
import { saveAttempt } from "@/lib/progress";

interface NumberedSlot {
  num: number;
  partIndex: number;
  cardAnchor: string;
  kind: "blank" | "selection" | "radio" | "multiple";
  key: string;
  acceptedBlank?: string[];
  expectedValue?: string;
  radioCorrectIdx?: number;
  multiGroupKey?: string;
  multiCorrectIndices?: number[];
  multiRank?: number;
}

export default function ExamWorkbench({ quiz }: { quiz: Record<string, any> }) {
  const skill: "reading" | "listening" | "writing" | "speaking" =
    quiz.type === 2 || quiz.type === 10
      ? "listening"
      : quiz.type === 7
      ? "writing"
      : quiz.type === 8 || quiz.questions?.[0]?.type === "speaking"
      ? "speaking"
      : "reading";

  const parts: any[] = useMemo(() => {
    if (Array.isArray(quiz.parts) && quiz.parts.length > 0) return quiz.parts;
    if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      return [{ id: quiz.id, title: quiz.title, content: quiz.content, questions: quiz.questions }];
    }
    return [];
  }, [quiz]);

  const [partIdx, setPartIdx] = useState(0);
  const [useSimplified, setUseSimplified] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [essay, setEssay] = useState("");
  const [writingTab, setWritingTab] = useState<"prompt" | "guide" | "sample">("prompt");
  const [showSpeakingSample, setShowSpeakingSample] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved essay draft for Writing
  useEffect(() => {
    if (skill === "writing" && typeof window !== "undefined") {
      const saved = window.localStorage.getItem(`ielts_draft_${quiz.id}`);
      if (saved) setEssay(saved);
    }
  }, [skill, quiz.id]);

  // Live exam timer
  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  // Build deterministic question numbering across all parts for Reading/Listening
  const { partQuestionMeta, allSlots } = useMemo(() => {
    if (skill === "writing" || skill === "speaking") {
      return { partQuestionMeta: [], allSlots: [] as NumberedSlot[] };
    }
    let seq = 1;
    const slots: NumberedSlot[] = [];
    const metaPerPart: any[][] = [];

    parts.forEach((part, pIndex) => {
      const qMetas: any[] = [];
      const normalizedQuestions = normalizePartQuestions(part);
      for (const q of normalizedQuestions) {
        const cardAnchor = `q-card-${q.id}`;
        if (q.type === "FILL-IN-THE-BLANK") {
          const tokens = parseGapFillHtml(q.gap_fill_in_blank || "");
          const blankSlots: NumberedSlot[] = [];
          for (const tk of tokens) {
            if (tk.kind === "blank") {
              const num = seq++;
              const key = `blank_${q.id}_${tk.blankNumber}`;
              const slot: NumberedSlot = {
                num,
                partIndex: pIndex,
                cardAnchor,
                kind: "blank",
                key,
                acceptedBlank: tk.acceptedAnswers || [],
              };
              slots.push(slot);
              blankSlots.push(slot);
            }
          }
          qMetas.push({ q, cardAnchor, tokens, blankSlots });
        } else if (q.type === "SINGLE-SELECTION") {
          const selItems = Array.isArray(q.selection) ? q.selection : [];
          const selSlots: NumberedSlot[] = selItems.map((sel: any, sIdx: number) => {
            const num = seq++;
            const key = `sel_${q.id}_${sIdx}`;
            const slot: NumberedSlot = {
              num,
              partIndex: pIndex,
              cardAnchor,
              kind: "selection",
              key,
              expectedValue: String(sel.answer ?? "").trim(),
            };
            slots.push(slot);
            return slot;
          });
          qMetas.push({ q, cardAnchor, selSlots });
        } else if (q.type === "SINGLE-RADIO") {
          const opts = Array.isArray(q.single_choice_radio) ? q.single_choice_radio : [];
          const correctIdx = opts.findIndex((o: any) => o.correct);
          const num = seq++;
          const key = `radio_${q.id}`;
          const slot: NumberedSlot = {
            num,
            partIndex: pIndex,
            cardAnchor,
            kind: "radio",
            key,
            radioCorrectIdx: correctIdx,
          };
          slots.push(slot);
          qMetas.push({ q, cardAnchor, slot });
        } else if (q.type === "MULTIPLE") {
          const opts = Array.isArray(q.mutilple_choice) ? q.mutilple_choice : [];
          const correctIndices = opts
            .map((o: any, idx: number) => (o.correct ? idx : -1))
            .filter((idx: number) => idx >= 0);
          const count = Math.max(1, correctIndices.length);
          const multiGroupKey = `multi_${q.id}`;
          const multiSlots: NumberedSlot[] = [];
          for (let r = 0; r < count; r++) {
            const num = seq++;
            const slot: NumberedSlot = {
              num,
              partIndex: pIndex,
              cardAnchor,
              kind: "multiple",
              key: `${multiGroupKey}_${r}`,
              multiGroupKey,
              multiCorrectIndices: correctIndices,
              multiRank: r,
            };
            slots.push(slot);
            multiSlots.push(slot);
          }
          qMetas.push({ q, cardAnchor, multiGroupKey, maxSelect: count, multiSlots });
        } else {
          qMetas.push({ q, cardAnchor });
        }
      }
      metaPerPart.push(qMetas);
    });

    return { partQuestionMeta: metaPerPart, allSlots: slots };
  }, [parts, skill]);

  function isSlotAnswered(slot: NumberedSlot): boolean {
    if (slot.kind === "blank" || slot.kind === "selection") {
      return Boolean(String(answers[slot.key] ?? "").trim());
    }
    if (slot.kind === "radio") {
      return typeof answers[slot.key] === "number";
    }
    if (slot.kind === "multiple" && slot.multiGroupKey !== undefined) {
      const picked: number[] = answers[slot.multiGroupKey] || [];
      return picked.length > (slot.multiRank || 0);
    }
    return false;
  }

  function isSlotCorrect(slot: NumberedSlot): boolean {
    if (slot.kind === "blank") {
      return isBlankCorrect(String(answers[slot.key] ?? ""), slot.acceptedBlank || []);
    }
    if (slot.kind === "selection") {
      return (
        String(answers[slot.key] ?? "").trim().toLowerCase() ===
        String(slot.expectedValue ?? "").trim().toLowerCase()
      );
    }
    if (slot.kind === "radio") {
      return answers[slot.key] === slot.radioCorrectIdx;
    }
    if (slot.kind === "multiple" && slot.multiGroupKey) {
      const picked: number[] = answers[slot.multiGroupKey] || [];
      const correctPicked = picked.filter((i) => slot.multiCorrectIndices?.includes(i));
      return (slot.multiRank || 0) < correctPicked.length;
    }
    return false;
  }

  const scoreSummary = useMemo(() => {
    if (allSlots.length === 0) return { correct: 0, total: 0, band: 0 };
    const correct = allSlots.filter((s) => isSlotCorrect(s)).length;
    const total = allSlots.length;
    return {
      correct,
      total,
      band: calculateIeltsBand(correct, total),
    };
  }, [allSlots, answers]);

  function handleSubmitObjective() {
    setSubmitted(true);
    if (skill === "listening") setShowTranscript(true);
    saveAttempt({
      quizId: quiz.id,
      title: quiz.title || `Đề #${quiz.id}`,
      skill,
      correct: scoreSummary.correct,
      total: scoreSummary.total,
      band: scoreSummary.band,
      durationSec: elapsedSec,
      completedAt: new Date().toISOString(),
    });
  }

  function handleSaveWriting() {
    const words = countWords(essay);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`ielts_draft_${quiz.id}`, essay);
    }
    setSubmitted(true);
    saveAttempt({
      quizId: quiz.id,
      title: quiz.title || `Writing #${quiz.id}`,
      skill: "writing",
      words,
      durationSec: elapsedSec,
      completedAt: new Date().toISOString(),
    });
  }

  function handleSaveSpeaking() {
    setSubmitted(true);
    setShowSpeakingSample(true);
    saveAttempt({
      quizId: quiz.id,
      title: quiz.title || `Speaking #${quiz.id}`,
      skill: "speaking",
      words: countWords(essay),
      durationSec: elapsedSec,
      completedAt: new Date().toISOString(),
    });
  }

  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const secs = String(elapsedSec % 60).padStart(2, "0");

  const activePart = parts[partIdx] || {};
  const audioSrc = audioAssetUrl(quiz.listening || activePart.file_id);
  const backHref =
    skill === "listening"
      ? "/listening"
      : skill === "writing"
      ? "/writing"
      : skill === "speaking"
      ? "/speaking"
      : "/reading";

  // ---------- WRITING WORKBENCH ----------
  if (skill === "writing") {
    const wq = quiz.questions?.[0] || activePart?.questions?.[0] || {};
    const minWords = wq.min_words || (quiz.writing_task_type === 1 ? 150 : 250);
    const words = countWords(essay);
    const graphImg = assetUrl(wq.writing_graph_image);
    const frames: any[] = Array.isArray(wq.writing_logical_frame) ? wq.writing_logical_frame : [];

    return (
      <div className="exam-shell">
        <header className="exam-header">
          <div className="exam-header-left">
            <Link href={backHref} className="btn sm">
              ← Writing
            </Link>
            <h1>{quiz.title}</h1>
          </div>
          <div className="exam-header-right">
            <span className="timer-box">
              {mins}:{secs}
            </span>
            <span className={`pill ${words >= minWords ? "pos" : ""}`}>
              {words} / {minWords} từ tối thiểu
            </span>
            <button type="button" className="btn sm primary" onClick={handleSaveWriting}>
              {submitted ? "Đã lưu bài viết" : "Lưu & Hoàn thành"}
            </button>
          </div>
        </header>

        <div className="exam-split">
          <div className="exam-pane">
            <div className="segmented" style={{ marginBottom: 16 }}>
              <button
                type="button"
                aria-pressed={writingTab === "prompt"}
                onClick={() => setWritingTab("prompt")}
              >
                Đề bài
              </button>
              {wq.instruction && (
                <button
                  type="button"
                  aria-pressed={writingTab === "guide"}
                  onClick={() => setWritingTab("guide")}
                >
                  Hướng dẫn viết
                </button>
              )}
              {frames.length > 0 && (
                <button
                  type="button"
                  aria-pressed={writingTab === "sample"}
                  onClick={() => setWritingTab("sample")}
                >
                  Bài mẫu từng đoạn ({frames.length})
                </button>
              )}
            </div>

            {writingTab === "prompt" && (
              <div className="passage-prose">
                {wq.content_writing ? (
                  <div dangerouslySetInnerHTML={{ __html: wq.content_writing }} />
                ) : (
                  <p style={{ fontWeight: 600 }}>{wq.title || quiz.title}</p>
                )}
                {graphImg && (
                  <img src={graphImg} alt={quiz.title || "Writing Task 1 Visual"} />
                )}
              </div>
            )}

            {writingTab === "guide" && wq.instruction && (
              <div
                className="passage-prose"
                dangerouslySetInnerHTML={{ __html: wq.instruction }}
              />
            )}

            {writingTab === "sample" && (
              <div style={{ display: "grid", gap: 12 }}>
                {frames.map((fr) => (
                  <div key={fr.id} className="q-card" style={{ marginBottom: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{fr.name}</div>
                    <div
                      className="passage-prose"
                      style={{ fontSize: 14.5 }}
                      dangerouslySetInnerHTML={{ __html: fr.value || "" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="exam-pane">
            <div className="panel-head">
              <h2>Bài làm của bạn</h2>
              <span className="panel-meta">Tự động lưu nháp trên trình duyệt</span>
            </div>
            <textarea
              aria-label="Soạn bài viết IELTS Writing"
              className="essay-textarea"
              placeholder="Bắt đầu viết bài luận của bạn tại đây..."
              value={essay}
              onChange={(e) => {
                setEssay(e.target.value);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(`ielts_draft_${quiz.id}`, e.target.value);
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------- SPEAKING WORKBENCH ----------
  if (skill === "speaking") {
    const sQuestions: any[] =
      quiz.questions?.length > 0
        ? quiz.questions
        : parts.flatMap((p) => p.questions || []);

    return (
      <div className="exam-shell">
        <header className="exam-header">
          <div className="exam-header-left">
            <Link href={backHref} className="btn sm">
              ← Speaking
            </Link>
            <h1>{quiz.title}</h1>
          </div>
          <div className="exam-header-right">
            <span className="timer-box">
              {mins}:{secs}
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => setShowSpeakingSample((v) => !v)}
            >
              {showSpeakingSample ? "Ẩn bài mẫu" : "Hiện bài mẫu & Từ vựng"}
            </button>
            <button type="button" className="btn sm primary" onClick={handleSaveSpeaking}>
              {submitted ? "Đã lưu" : "Hoàn thành"}
            </button>
          </div>
        </header>

        <div className="exam-split">
          <div className="exam-pane">
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>Câu hỏi từ giám khảo</h2>
            {sQuestions.map((sq, idx) => (
              <div key={sq.id || idx} className="q-card">
                <div className="q-head">
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className="q-num">{idx + 1}</span>
                    <strong style={{ fontSize: 15 }}>{sq.title}</strong>
                  </div>
                </div>
                {sq.audio_url && (
                  <audio
                    controls
                    src={audioAssetUrl(sq.audio_url) || sq.audio_url}
                    style={{ width: "100%", height: 34, marginTop: 6 }}
                  />
                )}
                {showSpeakingSample && (
                  <div className="explain-box">
                    {Array.isArray(sq.sample_answers) && sq.sample_answers.length > 0 ? (
                      sq.sample_answers.map((sa: any, sIdx: number) => (
                        <div key={sIdx} style={{ marginBottom: 12 }}>
                          {sa.idea && (
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              Ý tưởng: {sa.idea}
                            </div>
                          )}
                          <div
                            dangerouslySetInnerHTML={{ __html: sa.content || "" }}
                          />
                          {Array.isArray(sa.vocab) && sa.vocab.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              {sa.vocab.map((v: any, vIdx: number) => (
                                <span key={vIdx} className="pill">
                                  {v.value}: {v.meaning}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : sq.instruction ? (
                      <div dangerouslySetInnerHTML={{ __html: sq.instruction }} />
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Chưa có bài mẫu cho câu này.</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="exam-pane">
            <div className="panel-head">
              <h2>Ghi chú dàn ý trả lời (Note-taking)</h2>
              <span className="panel-meta">{countWords(essay)} từ</span>
            </div>
            <textarea
              aria-label="Dàn ý luyện nói Speaking"
              className="essay-textarea"
              placeholder="Ghi nhanh từ khóa, cấu trúc câu và ý chính trước khi bấm giờ nói..."
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------- READING & LISTENING SPLIT-PANE EXAM WORKBENCH ----------
  const currentQMetas = partQuestionMeta[partIdx] || [];
  const passageHtml =
    extractPartPassage(activePart, useSimplified, submitted) ||
    formatPassageHtml(quiz.content || "", submitted);

  return (
    <div className="exam-shell">
      <header className="exam-header">
        <div className="exam-header-left">
          <Link href={backHref} className="btn sm">
            ← {skill === "listening" ? "Listening" : "Reading"}
          </Link>
          <h1>{quiz.title}</h1>
          {parts.length > 1 && (
            <div className="segmented" role="tablist" aria-label="Các phần của đề">
              {parts.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  aria-pressed={partIdx === idx}
                  onClick={() => setPartIdx(idx)}
                >
                  Part {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="exam-header-right">
          {submitted && (
            <span className="pill pos" style={{ height: 28, fontSize: 13, padding: "0 10px" }}>
              Band {scoreSummary.band.toFixed(1)} · Đúng {scoreSummary.correct}/{scoreSummary.total}
            </span>
          )}
          <span className="timer-box">
            {mins}:{secs}
          </span>
          {!submitted ? (
            <button type="button" className="btn sm primary" onClick={handleSubmitObjective}>
              Nộp bài & Chấm điểm
            </button>
          ) : (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
                setElapsedSec(0);
              }}
            >
              Làm lại từ đầu
            </button>
          )}
        </div>
      </header>

      {audioSrc && (
        <div className="audio-bar">
          <span style={{ fontWeight: 500, fontSize: 13 }}>Audio phòng thi</span>
          <audio
            ref={audioRef}
            controls
            src={audioSrc}
          />
          <select
            aria-label="Tốc độ phát âm thanh"
            className="input"
            style={{ height: 32, padding: "0 8px" }}
            value={playbackRate}
            onChange={(e) => {
              const rate = Number(e.target.value);
              setPlaybackRate(rate);
              if (audioRef.current) audioRef.current.playbackRate = rate;
            }}
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>
      )}

      <div className="exam-split">
        {/* Left Pane: Passage or Transcript */}
        <div className="exam-pane">
          <div className="panel-head">
            <h2>{activePart.title || `Phần ${partIdx + 1}`}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {activePart.simplified_content && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setUseSimplified((v) => !v)}
                >
                  {useSimplified ? "Xem bản gốc" : "Bản từ vựng dễ"}
                </button>
              )}
              {skill === "listening" && passageHtml && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowTranscript((v) => !v)}
                >
                  {showTranscript ? "Ẩn Transcript" : "Xem Transcript"}
                </button>
              )}
            </div>
          </div>

          {skill === "listening" && !showTranscript ? (
            <div className="empty" style={{ minHeight: 180 }}>
              <div>
                <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                  Chế độ nghe chuẩn phòng thi
                </div>
                <p>
                  Bấm phát file âm thanh ở thanh phía trên và điền đáp án vào cột bên phải.
                  Transcript sẽ tự động mở sau khi nộp bài (hoặc bấm &ldquo;Xem Transcript&rdquo;).
                </p>
              </div>
            </div>
          ) : passageHtml ? (
            <div
              className="passage-prose"
              dangerouslySetInnerHTML={{ __html: passageHtml }}
            />
          ) : (
            <div className="empty">Đề này không có văn bản đính kèm ở cột trái.</div>
          )}
        </div>

        {/* Right Pane: Questions */}
        <div className="exam-pane">
          {currentQMetas.map((meta) => {
            const { q, cardAnchor } = meta;

            // 1. FILL-IN-THE-BLANK
            if (q.type === "FILL-IN-THE-BLANK") {
              const blankMap = new Map<number, NumberedSlot>();
              (meta.tokens || []).forEach((tk: any) => {
                if (tk.kind === "blank") {
                  const found = (meta.blankSlots as NumberedSlot[]).find(
                    (s) => s.key === `blank_${q.id}_${tk.blankNumber}`
                  );
                  if (found && tk.blankNumber !== undefined) blankMap.set(tk.blankNumber, found);
                }
              });

              return (
                <div key={q.id} id={cardAnchor} className="q-card">
                  {q.description && (
                    <div
                      className="passage-prose"
                      style={{ fontSize: 14, marginBottom: 8 }}
                      dangerouslySetInnerHTML={{ __html: q.description }}
                    />
                  )}
                  {q.title && (
                    <p style={{ fontWeight: 600, marginBottom: 10 }}>{q.title}</p>
                  )}

                  {mounted && (
                    <div className="passage-prose" style={{ fontSize: 14.5 }}>
                      {(meta.tokens || []).map((tk: any, tIdx: number) => {
                        if (tk.kind === "html") {
                          return (
                            <span
                              key={tIdx}
                              dangerouslySetInnerHTML={{ __html: tk.value }}
                            />
                          );
                        }
                        const slot = blankMap.get(tk.blankNumber);
                        if (!slot) return null;
                        const val = answers[slot.key] ?? "";
                        const ok = submitted ? isSlotCorrect(slot) : null;

                        return (
                          <span key={tIdx} className="blank-wrap">
                            <span className="q-num">{slot.num}</span>
                            <input
                              type="text"
                              aria-label={`Câu ${slot.num}`}
                              disabled={submitted}
                              className={`blank-input${
                                submitted ? (ok ? " correct" : " wrong") : ""
                              }`}
                              placeholder={`Câu ${slot.num}`}
                              value={val}
                              onChange={(e) =>
                                setAnswers((prev) => ({ ...prev, [slot.key]: e.target.value }))
                              }
                            />
                            {submitted && !ok && (
                              <span className="pill pos">
                                {(slot.acceptedBlank || []).join(" / ")}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {submitted && q.explain && (
                    <div
                      className="explain-box"
                      dangerouslySetInnerHTML={{ __html: q.explain }}
                    />
                  )}
                </div>
              );
            }

            // 2. SINGLE-SELECTION (Matching Headings / TFNG / YNNG / Matching Features)
            if (q.type === "SINGLE-SELECTION") {
              const options: any[] = Array.isArray(q.selection_option)
                ? q.selection_option
                : [];
              const selItems: any[] = Array.isArray(q.selection) ? q.selection : [];
              const fallbackBoxHtml =
                !q.description && q.gap_fill_in_blank
                  ? String(q.gap_fill_in_blank).replace(/\{\[[\s\S]*?\]\[\d+\]\}/g, "")
                  : "";

              return (
                <div key={q.id} id={cardAnchor} className="q-card">
                  {q.description && (
                    <div
                      className="passage-prose"
                      style={{ fontSize: 14, marginBottom: 8 }}
                      dangerouslySetInnerHTML={{ __html: q.description }}
                    />
                  )}
                  {fallbackBoxHtml && (
                    <div
                      className="passage-prose"
                      style={{
                        fontSize: 13.5,
                        padding: 12,
                        background: "var(--ground)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        marginBottom: 12,
                      }}
                      dangerouslySetInnerHTML={{ __html: fallbackBoxHtml }}
                    />
                  )}

                  {selItems.map((sel, sIdx) => {
                    const slot: NumberedSlot | undefined = meta.selSlots?.[sIdx];
                    if (!slot) return null;
                    const val = answers[slot.key] ?? "";
                    const ok = submitted ? isSlotCorrect(slot) : null;

                    return (
                      <div
                        key={slot.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "8px 0",
                          borderTop: sIdx > 0 ? "1px solid var(--rule)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                          <span className="q-num">{slot.num}</span>
                          <span
                            dangerouslySetInnerHTML={{ __html: sel.text || q.title || "" }}
                          />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <select
                            aria-label={`Chọn đáp án câu ${slot.num}`}
                            disabled={submitted}
                            className={`blank-input${
                              submitted ? (ok ? " correct" : " wrong") : ""
                            }`}
                            style={{ width: "auto", minWidth: 120 }}
                            value={val}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [slot.key]: e.target.value }))
                            }
                          >
                            <option value="">-- Chọn --</option>
                            {options.map((op: any, oIdx: number) => (
                              <option key={oIdx} value={op.option}>
                                {op.option}
                              </option>
                            ))}
                          </select>

                          {submitted && !ok && (
                            <span className="pill pos">{slot.expectedValue}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {submitted && q.explain && (
                    <div
                      className="explain-box"
                      dangerouslySetInnerHTML={{ __html: q.explain }}
                    />
                  )}
                </div>
              );
            }

            // 3. SINGLE-RADIO (Multiple Choice 1 answer)
            if (q.type === "SINGLE-RADIO") {
              const slot: NumberedSlot = meta.slot;
              const opts: any[] = Array.isArray(q.single_choice_radio)
                ? q.single_choice_radio
                : [];
              const picked = answers[slot.key];

              return (
                <div key={q.id} id={cardAnchor} className="q-card">
                  {q.description && (
                    <div
                      className="passage-prose"
                      style={{ fontSize: 14, marginBottom: 10 }}
                      dangerouslySetInnerHTML={{ __html: q.description }}
                    />
                  )}
                  <div className="q-head">
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span className="q-num">{slot.num}</span>
                      <span
                        style={{ fontWeight: 500 }}
                        dangerouslySetInnerHTML={{ __html: q.title || "" }}
                      />
                    </div>
                  </div>
                  <div className="choice-list">
                    {opts.map((opt, oIdx) => {
                      const isSel = picked === oIdx;
                      let stateCls = isSel ? " selected" : "";
                      if (submitted) {
                        if (opt.correct) stateCls = " correct";
                        else if (isSel && !opt.correct) stateCls = " wrong";
                      }
                      const letter = String.fromCharCode(65 + oIdx);
                      return (
                        <label key={oIdx} className={`choice-row${stateCls}`}>
                          <input
                            type="radio"
                            name={slot.key}
                            disabled={submitted}
                            checked={isSel}
                            onChange={() =>
                              setAnswers((prev) => ({ ...prev, [slot.key]: oIdx }))
                            }
                          />
                          <span>
                            <strong>{letter}.</strong>{" "}
                            <span dangerouslySetInnerHTML={{ __html: opt.text || "" }} />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {submitted && q.explain && (
                    <div
                      className="explain-box"
                      dangerouslySetInnerHTML={{ __html: q.explain }}
                    />
                  )}
                </div>
              );
            }

            // 4. MULTIPLE (Choose TWO / THREE / FOUR answers)
            if (q.type === "MULTIPLE") {
              const opts: any[] = Array.isArray(q.mutilple_choice) ? q.mutilple_choice : [];
              const mSlots: NumberedSlot[] = meta.multiSlots || [];
              const picked: number[] = answers[meta.multiGroupKey] || [];
              const firstNum = mSlots[0]?.num;
              const lastNum = mSlots[mSlots.length - 1]?.num;

              return (
                <div key={q.id} id={cardAnchor} className="q-card">
                  {q.description && (
                    <div
                      className="passage-prose"
                      style={{ fontSize: 14, marginBottom: 10 }}
                      dangerouslySetInnerHTML={{ __html: q.description }}
                    />
                  )}
                  <div className="q-head">
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span className="q-num">
                        {firstNum === lastNum ? firstNum : `${firstNum}–${lastNum}`}
                      </span>
                      <span
                        style={{ fontWeight: 500 }}
                        dangerouslySetInnerHTML={{ __html: q.title || "" }}
                      />
                    </div>
                  </div>
                  <div className="choice-list">
                    {opts.map((opt, oIdx) => {
                      const isSel = picked.includes(oIdx);
                      let stateCls = isSel ? " selected" : "";
                      if (submitted) {
                        if (opt.correct) stateCls = " correct";
                        else if (isSel && !opt.correct) stateCls = " wrong";
                      }
                      const letter = String.fromCharCode(65 + oIdx);
                      return (
                        <div key={oIdx}>
                          <label className={`choice-row${stateCls}`}>
                            <input
                              type="checkbox"
                              disabled={submitted}
                              checked={isSel}
                              onChange={() => {
                                setAnswers((prev) => {
                                  const cur: number[] = prev[meta.multiGroupKey] || [];
                                  if (cur.includes(oIdx)) {
                                    return {
                                      ...prev,
                                      [meta.multiGroupKey]: cur.filter((x) => x !== oIdx),
                                    };
                                  }
                                  if (cur.length >= meta.maxSelect) {
                                    return {
                                      ...prev,
                                      [meta.multiGroupKey]: [...cur.slice(1), oIdx],
                                    };
                                  }
                                  return {
                                    ...prev,
                                    [meta.multiGroupKey]: [...cur, oIdx],
                                  };
                                });
                              }}
                            />
                            <span>
                              <strong>{letter}.</strong>{" "}
                              <span dangerouslySetInnerHTML={{ __html: opt.text || "" }} />
                            </span>
                          </label>
                          {submitted && opt.explain && (
                            <div
                              className="explain-box"
                              dangerouslySetInnerHTML={{ __html: opt.explain }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {submitted && q.explain && (
                    <div
                      className="explain-box"
                      dangerouslySetInnerHTML={{ __html: q.explain }}
                    />
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {allSlots.length > 0 && (
        <footer className="exam-footer" aria-label="Điều hướng câu hỏi">
          <div className="q-Jump-strip">
            {allSlots.map((slot) => {
              let cls = "";
              if (submitted) {
                cls = isSlotCorrect(slot) ? " correct" : " wrong";
              } else if (isSlotAnswered(slot)) {
                cls = " answered";
              }
              return (
                <button
                  key={`${slot.key}-${slot.num}`}
                  type="button"
                  className={`q-jump${cls}`}
                  onClick={() => {
                    if (partIdx !== slot.partIndex) {
                      setPartIdx(slot.partIndex);
                      setTimeout(() => {
                        document
                          .getElementById(slot.cardAnchor)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 80);
                    } else {
                      document
                        .getElementById(slot.cardAnchor)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                >
                  {slot.num}
                </button>
              );
            })}
          </div>
          <span className="panel-meta num" style={{ whiteSpace: "nowrap" }}>
            Đã trả lời {allSlots.filter((s) => isSlotAnswered(s)).length} / {allSlots.length} câu
          </span>
        </footer>
      )}
    </div>
  );
}
