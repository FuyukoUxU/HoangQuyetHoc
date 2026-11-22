"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { CatalogQuizItem } from "@/lib/ielts";
import { useAttempts } from "@/lib/progress";

const PAGE_SIZE = 30;

export default function SkillBankClient({
  heading,
  subtitle,
  items,
  subTypeTabs,
}: {
  heading: string;
  subtitle: string;
  items: CatalogQuizItem[];
  subTypeTabs?: { value: string; label: string }[];
}) {
  const attempts = useAttempts();
  const attemptMap = useMemo(
    () => new Map(attempts.map((a) => [a.quizId, a])),
    [attempts]
  );

  const [subTab, setSubTab] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [doneFilter, setDoneFilter] = useState<"all" | "todo" | "done">("all");
  const [page, setPage] = useState(1);

  const topTags = useMemo(() => {
    const counts = new Map<string, { code: string; title: string; count: number }>();
    for (const it of items) {
      for (const tg of it.tags || []) {
        if (!tg.code) continue;
        const prev = counts.get(tg.code);
        if (prev) prev.count += 1;
        else counts.set(tg.code, { code: tg.code, title: tg.title, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 24);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (subTab !== "all" && it.subType !== subTab) return false;
      if (tagFilter !== "all" && !it.tags.some((t) => t.code === tagFilter)) return false;
      const isDone = attemptMap.has(it.id);
      if (doneFilter === "done" && !isDone) return false;
      if (doneFilter === "todo" && isDone) return false;
      if (q) {
        const hay = `${it.title} ${it.id} ${it.tags.map((t) => t.title).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, subTab, tagFilter, doneFilter, query, attemptMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{heading}</h1>
          <p className="title-sub">{subtitle}</p>
        </div>
        <div className="stamp num">
          Hiển thị {filtered.length.toLocaleString("en-US")} / {items.length.toLocaleString("en-US")} đề
        </div>
      </div>

      <div className="filters">
        {subTypeTabs && (
          <div className="segmented" role="group" aria-label="Loại bài">
            <button
              type="button"
              aria-pressed={subTab === "all"}
              onClick={() => {
                setSubTab("all");
                setPage(1);
              }}
            >
              Tất cả
            </button>
            {subTypeTabs.map((tb) => (
              <button
                key={tb.value}
                type="button"
                aria-pressed={subTab === tb.value}
                onClick={() => {
                  setSubTab(tb.value);
                  setPage(1);
                }}
              >
                {tb.label}
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          className="input"
          placeholder="Tìm tên bài, mã C18T1, Forecast..."
          aria-label="Tìm kiếm đề thi"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: 250 }}
        />

        <select
          className="input"
          aria-label="Lọc theo dạng bài hoặc bộ sách"
          value={tagFilter}
          onChange={(e) => {
            setTagFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Mọi dạng bài & bộ sách</option>
          {topTags.map((tg) => (
            <option key={tg.code} value={tg.code}>
              {tg.title} ({tg.count})
            </option>
          ))}
        </select>

        <select
          className="input"
          aria-label="Trạng thái làm bài"
          value={doneFilter}
          onChange={(e) => {
            setDoneFilter(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="all">Mọi trạng thái</option>
          <option value="todo">Chưa làm</option>
          <option value="done">Đã hoàn thành</option>
        </select>
      </div>

      <section className="panel" aria-label="Danh sách đề thi">
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty">Không có đề thi nào khớp với bộ lọc hiện tại.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tên đề luyện</th>
                  <th>Phân loại & Nguồn đề</th>
                  <th className="n">Kết quả</th>
                  <th className="n">Mã đề</th>
                  <th className="n">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const att = attemptMap.get(item.id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/practice/${item.id}`} className="cell-title">
                          {item.title}
                        </Link>
                      </td>
                      <td>
                        <div className="cell-sub" style={{ marginTop: 0 }}>
                          {item.tags.slice(0, 4).map((tg) => (
                            <span key={tg.id} className="pill">
                              {tg.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="n num">
                        {att ? (
                          att.band ? (
                            <span className="pill pos">
                              Band {att.band.toFixed(1)} ({att.correct}/{att.total})
                            </span>
                          ) : (
                            <span className="pill pos">{att.words || 0} từ</span>
                          )
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td className="n code-id">#{item.id}</td>
                      <td className="n">
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {item.simplified_id && (
                            <Link
                              href={`/practice/${item.simplified_id}`}
                              className="btn sm"
                              title="Bản từ vựng đơn giản hóa (Simplified)"
                            >
                              Bản dễ
                            </Link>
                          )}
                          <Link href={`/practice/${item.id}`} className="btn sm primary">
                            {att ? "Làm lại" : "Làm bài"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="panel-foot">
            <span className="panel-meta num">
              Hiển thị {startIdx + 1}–{Math.min(filtered.length, startIdx + PAGE_SIZE)} trong{" "}
              {filtered.length.toLocaleString("en-US")} đề
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </button>
              <span className="btn sm" style={{ cursor: "default" }}>
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
