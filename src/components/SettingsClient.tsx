"use client";

import React, { useEffect, useState } from "react";

export default function SettingsClient({
  initialStatus,
  initialAuthJson,
}: {
  initialStatus: any;
  initialAuthJson: string;
}) {
  const [status, setStatus] = useState<any>(initialStatus);
  const [cookiesText, setCookiesText] = useState(initialAuthJson);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok) setStatus(await res.json());
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  async function handleSave(runCrawl: boolean, runAudioCrawl = false) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookiesJson: runAudioCrawl ? undefined : cookiesText,
          runCrawl,
          runAudioCrawl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lỗi cập nhật");
      setMessage(
        runAudioCrawl
          ? "Đã khởi chạy tiến trình tải toàn bộ file nghe MP3 chạy nền."
          : runCrawl
          ? "Đã lưu Cookie và khởi chạy tiến trình tải kho đề chạy nền."
          : "Đã lưu Cookie xác thực thành công."
      );
    } catch (err: any) {
      setMessage(`Lỗi: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const total = status.totalQuizzes || 0;
  const done = Math.min(status.downloadedFiles || 0, total || status.downloadedFiles || 0);
  const pct = total > 0 ? Math.min(100, ((done / total) * 100)).toFixed(1) : "0.0";
  const audioDone = status.audio?.downloaded || 0;
  const audioTotal = status.audio?.total || 0;
  const audioMb = ((status.audio?.totalBytes || 0) / 1024 / 1024).toFixed(0);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Đồng bộ dữ liệu & Cookie</h1>
          <p className="title-sub">
            Quản lý tiến trình crawl kho đề YouPass ngoại tuyến và cập nhật phiên đăng nhập khi cần
          </p>
        </div>
        <div className="title-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => handleSave(false, true)}
          >
            Tải file nghe MP3
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => handleSave(true)}
          >
            Chạy đồng bộ tiếp
          </button>
        </div>
      </div>

      <section className="kpis" aria-label="Trạng thái tải đề">
        <div className="kpi">
          <div className="kpi-label">Gói đề đã tải về máy</div>
          <div className="kpi-value lead num">
            {done.toLocaleString("en-US")}
            <span className="kpi-unit">/ {total.toLocaleString("en-US")}</span>
          </div>
          <div className="kpi-sub">Hoàn thành {pct}% toàn bộ ngân hàng đề</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">File nghe ngoại tuyến</div>
          <div className="kpi-value num">
            {audioDone.toLocaleString("en-US")}
            <span className="kpi-unit">/ {audioTotal.toLocaleString("en-US")}</span>
          </div>
          <div className="kpi-sub">
            {Number(audioMb) > 0 ? `${audioMb} MB` : "Listening & Speaking MP3"} ·{" "}
            {audioDone >= audioTotal && audioTotal > 0 ? "Hoàn tất" : "Đang tải nền"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Tài khoản kết nối</div>
          <div className="kpi-value" style={{ fontSize: 18, wordBreak: "break-all" }}>
            {status.account?.email || "Chưa xác định"}
          </div>
          <div className="kpi-sub">{status.account?.name || "Tự động làm mới JWT"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cơ chế đọc đề tức thì</div>
          <div className="kpi-value" style={{ fontSize: 22 }}>
            On-demand
          </div>
          <div className="kpi-sub">Mở bất kỳ đề nào ngay cả khi chưa tải tới</div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: "var(--gap)" }}>
        <div className="panel-head">
          <h2>Cookie xác thực YouPass (.youpass.vn)</h2>
          <span className="panel-meta">Lưu tại data/auth.json</span>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          Hệ thống tự động dùng <code>directus_refresh_token</code> để gia hạn phiên đăng nhập. Nếu sau này phiên hết hạn hoàn toàn, dán mảng JSON Cookie mới vào ô dưới đây rồi bấm lưu.
        </p>
        <textarea
          aria-label="JSON Cookie xác thực"
          className="essay-textarea"
          style={{ minHeight: 240, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.5 }}
          value={cookiesText}
          onChange={(e) => setCookiesText(e.target.value)}
        />
        <div className="panel-foot">
          <span className="panel-meta">
            {message || "Hỗ trợ định dạng xuất từ Cookie-Editor / EditThisCookie"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => handleSave(false)}
            >
              Chỉ lưu Cookie
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => handleSave(true)}
            >
              Lưu & Đồng bộ đề mới
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
