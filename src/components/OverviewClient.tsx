"use client";

import React from "react";
import Link from "next/link";
import type { CatalogData } from "@/lib/ielts";
import { useAttempts } from "@/lib/progress";

export default function OverviewClient({
  catalog,
  downloadedFiles,
}: {
  catalog: CatalogData;
  downloadedFiles: number;
}) {
  const attempts = useAttempts();
  const c = catalog.counts;

  const scored = attempts.filter((a) => typeof a.band === "number" && a.band > 0);
  const avgBand =
    scored.length > 0
      ? (scored.reduce((s, a) => s + (a.band || 0), 0) / scored.length).toFixed(1)
      : null;

  const skillBars = [
    { label: "Speaking (câu hỏi)", count: c.speakingQuestionsTotal, href: "/speaking" },
    { label: "Writing (Task 1 & 2)", count: c.writingTotal, href: "/writing" },
    { label: "Listening (Section 1–4)", count: c.listening, href: "/listening" },
    { label: "Reading (Passage 1–3)", count: c.reading, href: "/reading" },
    { label: "Full Simulation Tests", count: c.mockTotal, href: "/mock-tests" },
  ];
  const maxTick = 2500;

  const featuredMocks = [
    ...(catalog.mockTests.reading[0]?.mock_tests || []).slice(0, 3).map((m) => ({
      id: m.quizzes?.full?.id || m.id,
      title: m.title,
      skill: "Reading",
      questions: m.quizzes?.full?.question_count || 40,
      minutes: m.quizzes?.full?.time || 60,
    })),
    ...(catalog.mockTests.listening[0]?.mock_tests || []).slice(0, 2).map((m) => ({
      id: m.quizzes?.full?.id || m.id,
      title: m.title,
      skill: "Listening",
      questions: m.quizzes?.full?.question_count || 40,
      minutes: m.quizzes?.full?.time || 40,
    })),
  ];

  const starterQuizzes = [
    ...catalog.reading.slice(0, 2),
    ...catalog.listening.slice(0, 2),
    ...catalog.writing.task2.slice(0, 1),
  ];

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Kho đề IELTS 4 kỹ năng</h1>
          <p className="title-sub">
            Đã lưu ngoại tuyến {downloadedFiles.toLocaleString("en-US")} gói dữ liệu đề thi từ tài khoản{" "}
            {catalog.account.email}
          </p>
        </div>
        <div className="title-actions">
          <Link href="/settings" className="btn">
            Đồng bộ đề
          </Link>
          <Link href="/mock-tests" className="btn primary">
            Thi thử Full Test
          </Link>
        </div>
      </div>

      <section className="kpis" aria-label="Chỉ số kho đề">
        <div className="kpi">
          <div className="kpi-label">Gói đề ngoại tuyến</div>
          <div className="kpi-value lead num">
            {downloadedFiles.toLocaleString("en-US")}
            <span className="kpi-unit">gói</span>
          </div>
          <div className="kpi-sub">
            Đầy đủ đề bài, đáp án & giải thích chi tiết
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Reading & Listening</div>
          <div className="kpi-value num">
            {(c.reading + c.listening).toLocaleString("en-US")}
            <span className="kpi-unit">bài</span>
          </div>
          <div className="kpi-sub">
            {c.reading} Reading · {c.listening} Listening
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Writing & Speaking</div>
          <div className="kpi-value num">
            {(c.writingTotal + c.speakingTopicsTotal).toLocaleString("en-US")}
            <span className="kpi-unit">chủ đề</span>
          </div>
          <div className="kpi-sub">
            {c.writingTotal} Writing · {c.speakingTopicsTotal} Speaking
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Tiến độ cá nhân</div>
          <div className="kpi-value num">
            {attempts.length.toLocaleString("en-US")}
            <span className="kpi-unit">bài đã làm</span>
          </div>
          <div className="kpi-sub">
            {avgBand ? `Band trung bình ${avgBand}` : "Chưa có điểm chấm"}
          </div>
        </div>
      </section>

      <div className="grid">
        <section className="panel col-7" aria-labelledby="chart-bank-heading">
          <div className="panel-head">
            <h2 id="chart-bank-heading">Phân bổ ngân hàng câu hỏi & bài thi</h2>
            <span className="panel-meta">Đơn vị: bài / câu hỏi</span>
          </div>
          <svg
            viewBox="0 0 620 272"
            role="img"
            aria-label="Biểu đồ số lượng đề thi theo từng kỹ năng IELTS"
            style={{ width: "100%", height: "auto" }}
          >
            {[0, 500, 1000, 1500, 2000, 2500].map((tick) => {
              const x = 180 + (tick / maxTick) * 380;
              return (
                <g key={tick}>
                  <line
                    x1={x}
                    y1={10}
                    x2={x}
                    y2={236}
                    stroke={tick === 0 ? "#c9cfd8" : "#e6eaf0"}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={258}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#555b66"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {tick.toLocaleString("en-US")}
                  </text>
                </g>
              );
            })}
            {skillBars.map((row, idx) => {
              const y = 20 + idx * 44;
              const w = Math.max(3, (row.count / maxTick) * 380);
              return (
                <g key={row.label}>
                  <text x={0} y={y + 16} fontSize="13" fill="#0f1115">
                    {row.label}
                  </text>
                  <rect x={180} y={y + 3} width={w} height={18} fill="#1d5fbf" />
                  <text
                    x={616}
                    y={y + 16}
                    textAnchor="end"
                    fontSize="13"
                    fill="#0f1115"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {row.count.toLocaleString("en-US")}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="panel-foot">
            <span className="panel-meta">Bao gồm Cambridge C6–C20, Forecast 2025–2026 & Official</span>
            <Link href="/reading" className="cell-title" style={{ fontSize: 13 }}>
              Mở ngân hàng đề →
            </Link>
          </div>
        </section>

        <section className="panel col-5" aria-labelledby="mock-quick-heading">
          <div className="panel-head">
            <h2 id="mock-quick-heading">Đề thi thử Simulation mới nhất</h2>
            <Link href="/mock-tests" className="panel-meta" style={{ color: "var(--text)", fontWeight: 500 }}>
              Xem cả {c.mockTotal} đề →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đề thi</th>
                  <th className="n">Thời lượng</th>
                  <th className="n">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {featuredMocks.map((m) => (
                  <tr key={`${m.skill}-${m.id}`}>
                    <td>
                      <Link href={`/practice/${m.id}`} className="cell-title">
                        {m.title}
                      </Link>
                      <span className="cell-sub">
                        {m.skill} · {m.questions} câu
                      </span>
                    </td>
                    <td className="n num">{m.minutes} phút</td>
                    <td className="n">
                      <Link href={`/practice/${m.id}`} className="btn sm">
                        Làm bài
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "var(--gap)" }} aria-labelledby="recent-heading">
        <div className="panel-head">
          <h2 id="recent-heading">
            {attempts.length > 0 ? "Bài làm gần đây của bạn" : "Đề gợi ý bắt đầu ngay"}
          </h2>
          <span className="panel-meta">
            {attempts.length > 0
              ? `${attempts.length} lượt nộp bài đã lưu`
              : "Chọn 1 bài bên dưới để mở giao diện phòng thi"}
          </span>
        </div>

        <div className="table-wrap">
          {attempts.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Tên bài thi</th>
                  <th>Kỹ năng</th>
                  <th className="n">Kết quả</th>
                  <th className="n">Band</th>
                  <th className="n">Thời gian làm</th>
                  <th className="n">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 8).map((a) => (
                  <tr key={a.quizId}>
                    <td>
                      <Link href={`/practice/${a.quizId}`} className="cell-title">
                        {a.title}
                      </Link>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{a.skill}</td>
                    <td className="n num">
                      {typeof a.correct === "number" && typeof a.total === "number"
                        ? `${a.correct} / ${a.total}`
                        : a.words
                        ? `${a.words} từ`
                        : "—"}
                    </td>
                    <td className="n num">
                      {a.band ? <span className="pill pos">Band {a.band.toFixed(1)}</span> : "—"}
                    </td>
                    <td className="n num">
                      {Math.max(1, Math.round(a.durationSec / 60))} phút
                    </td>
                    <td className="n">
                      <Link href={`/practice/${a.quizId}`} className="btn sm">
                        Làm lại
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Đề thi tiêu biểu</th>
                  <th>Kỹ năng</th>
                  <th>Chủ đề & Dạng câu hỏi</th>
                  <th className="n">Mã đề</th>
                  <th className="n">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {starterQuizzes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/practice/${q.id}`} className="cell-title">
                        {q.title}
                      </Link>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{q.skill}</td>
                    <td>
                      <div className="cell-sub" style={{ marginTop: 0 }}>
                        {q.tags.slice(0, 3).map((t) => (
                          <span key={t.id} className="pill">
                            {t.title}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="n code-id">#{q.id}</td>
                    <td className="n">
                      <Link href={`/practice/${q.id}`} className="btn sm">
                        Bắt đầu
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
