"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { audioAssetUrl, type SpeakingTopicItem } from "@/lib/ielts";

export default function SpeakingBankClient({
  part1,
  part2,
  part3,
}: {
  part1: SpeakingTopicItem[];
  part2: SpeakingTopicItem[];
  part3: SpeakingTopicItem[];
}) {
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<SpeakingTopicItem | null>(
    part1[0] || null
  );
  const [activeQuizData, setActiveQuizData] = useState<Record<number, any>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const topics = part === 1 ? part1 : part === 2 ? part2 : part3;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.quizzes.some((qz) => qz.title.toLowerCase().includes(q))
    );
  }, [topics, query]);

  async function toggleQuestionDetail(quizId: number) {
    if (activeQuizData[quizId]) {
      const copy = { ...activeQuizData };
      delete copy[quizId];
      setActiveQuizData(copy);
      return;
    }
    setLoadingId(quizId);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      if (res.ok) {
        const json = await res.json();
        setActiveQuizData((prev) => ({ ...prev, [quizId]: json }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1>IELTS Speaking</h1>
          <p className="title-sub">
            399 chủ đề Speaking Part 1, 2, 3 kèm giọng đọc giám khảo bản xứ, từ vựng ăn điểm và câu trả lời mẫu
          </p>
        </div>
        <div className="stamp num">
          {(part1.length + part2.length + part3.length).toLocaleString("en-US")} chủ đề
        </div>
      </div>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Chọn Part Speaking">
          <button
            type="button"
            aria-pressed={part === 1}
            onClick={() => {
              setPart(1);
              setSelectedTopic(part1[0] || null);
            }}
          >
            Part 1 ({part1.length})
          </button>
          <button
            type="button"
            aria-pressed={part === 2}
            onClick={() => {
              setPart(2);
              setSelectedTopic(part2[0] || null);
            }}
          >
            Part 2 ({part2.length})
          </button>
          <button
            type="button"
            aria-pressed={part === 3}
            onClick={() => {
              setPart(3);
              setSelectedTopic(part3[0] || null);
            }}
          >
            Part 3 ({part3.length})
          </button>
        </div>

        <input
          type="search"
          className="input"
          placeholder="Tìm chủ đề hoặc câu hỏi Speaking..."
          aria-label="Tìm chủ đề Speaking"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </div>

      <div className="grid" style={{ alignItems: "start" }}>
        <section className="panel col-5" aria-label="Danh sách chủ đề Speaking">
          <div className="panel-head">
            <h2>Chủ đề Part {part}</h2>
            <span className="panel-meta num">{filtered.length} chủ đề</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 620, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Chủ đề</th>
                  <th className="n">Số câu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tp) => {
                  const isSel = selectedTopic?.id === tp.id;
                  return (
                    <tr
                      key={tp.id}
                      aria-selected={isSel}
                      style={{
                        cursor: "pointer",
                        background: isSel ? "var(--active)" : undefined,
                      }}
                      onClick={() => setSelectedTopic(tp)}
                    >
                      <td>
                        <span className="cell-title">{tp.title}</span>
                        {tp.tags.length > 0 && (
                          <span className="cell-sub">{tp.tags[0].title}</span>
                        )}
                      </td>
                      <td className="n num">{tp.quizzes.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel col-7" aria-label="Chi tiết câu hỏi trong chủ đề">
          {!selectedTopic ? (
            <div className="empty">Chọn một chủ đề ở cột bên trái để luyện tập câu hỏi và bài mẫu.</div>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <h2>{selectedTopic.title}</h2>
                  <span className="panel-meta">
                    Part {selectedTopic.part} · {selectedTopic.quizzes.length} câu hỏi
                  </span>
                </div>
                {selectedTopic.quizzes[0] && (
                  <Link href={`/practice/${selectedTopic.quizzes[0].id}`} className="btn sm primary">
                    Mở phòng luyện
                  </Link>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {selectedTopic.quizzes.map((qz, idx) => {
                  const detail = activeQuizData[qz.id];
                  const qObj = detail?.questions?.[0];
                  return (
                    <div key={qz.id} className="q-card" style={{ marginBottom: 0 }}>
                      <div className="q-head" style={{ marginBottom: detail ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span className="q-num">{idx + 1}</span>
                          <span style={{ fontWeight: 500 }}>{qz.title}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => toggleQuestionDetail(qz.id)}
                          >
                            {loadingId === qz.id
                              ? "Đang tải..."
                              : detail
                              ? "Ẩn bài mẫu"
                              : "Nghe & Bài mẫu"}
                          </button>
                        </div>
                      </div>

                      {detail && qObj && (
                        <div className="explain-box">
                          {qObj.audio_url && (
                            <div style={{ marginBottom: 10 }}>
                              <audio
                                controls
                                src={audioAssetUrl(qObj.audio_url) || qObj.audio_url}
                                style={{ width: "100%", height: 34 }}
                              />
                            </div>
                          )}

                          {Array.isArray(qObj.sample_answers) && qObj.sample_answers.length > 0 ? (
                            <div style={{ display: "grid", gap: 12 }}>
                              {qObj.sample_answers.map((sa: any, sIdx: number) => (
                                <div key={sIdx} style={{ paddingTop: sIdx > 0 ? 10 : 0, borderTop: sIdx > 0 ? "1px solid var(--border)" : "none" }}>
                                  {sa.idea && (
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                      Hướng trả lời {sIdx + 1}: {sa.idea}
                                    </div>
                                  )}
                                  <div
                                    className="passage-prose"
                                    style={{ fontSize: 14 }}
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
                              ))}
                            </div>
                          ) : qObj.instruction ? (
                            <div
                              className="passage-prose"
                              style={{ fontSize: 14 }}
                              dangerouslySetInnerHTML={{ __html: qObj.instruction }}
                            />
                          ) : (
                            <div style={{ color: "var(--muted)" }}>Chưa có bài mẫu đính kèm cho câu hỏi này.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
