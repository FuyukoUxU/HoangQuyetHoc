"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { MockTestBook } from "@/lib/ielts";
import { useAttempts } from "@/lib/progress";

export default function MockTestsClient({
  readingBooks,
  listeningBooks,
  speakingBooks,
}: {
  readingBooks: MockTestBook[];
  listeningBooks: MockTestBook[];
  speakingBooks: MockTestBook[];
}) {
  const [skill, setSkill] = useState<"reading" | "listening" | "speaking">("reading");
  const attempts = useAttempts();
  const attemptMap = new Map(attempts.map((a) => [a.quizId, a]));

  const books =
    skill === "reading"
      ? readingBooks
      : skill === "listening"
      ? listeningBooks
      : speakingBooks;

  const countTests = (list: MockTestBook[]) =>
    list.reduce((s, b) => s + (b.mock_tests?.length || 0), 0);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Thi thử Full Simulation Test</h1>
          <p className="title-sub">
            Đề thi nguyên bộ chuẩn cấu trúc 60 phút / 40 câu từ Cambridge, Forecast và YouPass Simulation
          </p>
        </div>
        <div className="stamp num">
          {(
            countTests(readingBooks) +
            countTests(listeningBooks) +
            countTests(speakingBooks)
          ).toLocaleString("en-US")}{" "}
          bộ đề
        </div>
      </div>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Kỹ năng Full Test">
          <button
            type="button"
            aria-pressed={skill === "reading"}
            onClick={() => setSkill("reading")}
          >
            Reading ({countTests(readingBooks)})
          </button>
          <button
            type="button"
            aria-pressed={skill === "listening"}
            onClick={() => setSkill("listening")}
          >
            Listening ({countTests(listeningBooks)})
          </button>
          <button
            type="button"
            aria-pressed={skill === "speaking"}
            onClick={() => setSkill("speaking")}
          >
            Speaking ({countTests(speakingBooks)})
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--gap)" }}>
        {books.map((book, bIdx) => (
          <section key={`${book.title}-${bIdx}`} className="panel">
            <div className="panel-head">
              <h2>{book.title}</h2>
              <span className="panel-meta num">{book.mock_tests.length} đề</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên đề thi</th>
                    <th>Các phần lẻ</th>
                    <th className="n">Kết quả Full Test</th>
                    <th className="n">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {book.mock_tests.map((mt) => {
                    const qMap = mt.quizzes || {};
                    const fullQuiz = qMap.full;
                    const partKeys = Object.keys(qMap).filter((k) => k !== "full" && qMap[k]?.id);
                    const att = fullQuiz?.id ? attemptMap.get(fullQuiz.id) : undefined;

                    return (
                      <tr key={mt.id}>
                        <td>
                          {fullQuiz?.id ? (
                            <Link href={`/practice/${fullQuiz.id}`} className="cell-title">
                              {mt.title}
                            </Link>
                          ) : (
                            <span className="cell-title">{mt.title}</span>
                          )}
                          <span className="cell-sub">
                            {mt.book_code}
                            {fullQuiz?.question_count ? ` · ${fullQuiz.question_count} câu` : ""}
                            {fullQuiz?.time ? ` · ${fullQuiz.time} phút` : ""}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {partKeys.map((pk) => (
                              <Link
                                key={pk}
                                href={`/practice/${qMap[pk].id}`}
                                className="btn sm"
                              >
                                {pk.replace("_", " ").toUpperCase()}
                              </Link>
                            ))}
                          </div>
                        </td>
                        <td className="n num">
                          {att?.band ? (
                            <span className="pill pos">
                              Band {att.band.toFixed(1)} ({att.correct}/{att.total})
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td className="n">
                          {fullQuiz?.id ? (
                            <Link href={`/practice/${fullQuiz.id}`} className="btn sm primary">
                              Thi Full Test
                            </Link>
                          ) : partKeys[0] ? (
                            <Link href={`/practice/${qMap[partKeys[0]].id}`} className="btn sm primary">
                              Làm bài
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
