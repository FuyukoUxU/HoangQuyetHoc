"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavCounts {
  reading: number;
  listening: number;
  writingTotal: number;
  speakingTopicsTotal: number;
  mockTotal: number;
  uniqueQuizPayloads: number;
}

interface StatusInfo {
  state?: string;
  downloadedFiles: number;
  totalQuizzes: number;
  audio?: {
    state: string;
    downloaded: number;
    total: number;
    totalBytes: number;
  };
  account?: { email?: string; name?: string } | null;
  counts?: NavCounts | null;
}

export default function AppShell({
  initialStatus,
  children,
}: {
  initialStatus: StatusInfo;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<StatusInfo>(initialStatus);

  const isExamMode = pathname.startsWith("/practice/");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isExamMode) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok) {
          const next = await res.json();
          setStatus(next);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(timer);
  }, [isExamMode]);

  if (isExamMode) {
    return <>{children}</>;
  }

  const c = status.counts;
  const total = status.totalQuizzes || c?.uniqueQuizPayloads || 0;
  const done = Math.min(status.downloadedFiles || 0, total || status.downloadedFiles || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const navLinks = [
    {
      group: "Bàn làm việc",
      items: [
        {
          href: "/",
          label: "Tổng quan",
          count: null,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          ),
        },
        {
          href: "/mock-tests",
          label: "Thi thử Full Test",
          count: c?.mockTotal ?? 211,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" />
            </svg>
          ),
        },
      ],
    },
    {
      group: "Luyện 4 kỹ năng",
      items: [
        {
          href: "/reading",
          label: "Reading",
          count: c?.reading ?? 533,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          ),
        },
        {
          href: "/listening",
          label: "Listening",
          count: c?.listening ?? 711,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" strokeLinecap="round" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          ),
        },
        {
          href: "/writing",
          label: "Writing",
          count: c?.writingTotal ?? 901,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 20h9" strokeLinecap="round" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
            </svg>
          ),
        },
        {
          href: "/speaking",
          label: "Speaking",
          count: c?.speakingTopicsTotal ?? 399,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" strokeLinecap="round" />
            </svg>
          ),
        },
      ],
    },
    {
      group: "Hệ thống",
      items: [
        {
          href: "/settings",
          label: "Đồng bộ & Cookie",
          count: null,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" />
              <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" strokeLinecap="round" />
              <path d="M16 16h5v5" strokeLinecap="round" />
            </svg>
          ),
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="btn sm"
            aria-label="Mở danh mục"
            onClick={() => setMenuOpen(true)}
          >
            Menu
          </button>
          <span style={{ fontWeight: 600 }}>IELTS Ledger</span>
        </div>
        <Link href="/mock-tests" className="btn sm primary">
          Full Test
        </Link>
      </header>

      <div className="app">
        <aside className={`sidebar${menuOpen ? " open" : ""}`} aria-label="Điều hướng chính">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">
              IL
            </div>
            <div className="brand-meta">
              <div className="brand-name">IELTS Ledger</div>
              <div className="brand-scope">
                {status.account?.email || "YouPass Local Archive"}
              </div>
            </div>
            {menuOpen && (
              <button
                type="button"
                className="btn sm"
                style={{ marginLeft: "auto" }}
                onClick={() => setMenuOpen(false)}
              >
                Đóng
              </button>
            )}
          </div>

          {navLinks.map((section) => (
            <React.Fragment key={section.group}>
              <div className="group-label">{section.group}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <span className="nav-item-left">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.count !== null && (
                    <span className="nav-count">{item.count.toLocaleString("en-US")}</span>
                  )}
                </Link>
              ))}
            </React.Fragment>
          ))}

          <div className="sidebar-bottom">
            <Link href="/settings" className="sync-box" style={{ display: "block" }}>
              <div className="sync-row">
                <span style={{ fontWeight: 500 }}>Kho đề ngoại tuyến</span>
                <span className="num" style={{ color: "var(--muted)" }}>
                  {pct}%
                </span>
              </div>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="sync-row" style={{ marginTop: 6, color: "var(--muted)" }}>
                <span>
                  {done.toLocaleString("en-US")} / {total.toLocaleString("en-US")} đề
                </span>
                <span>{done < total ? "Đang tải" : "Hoàn tất"}</span>
              </div>
              {status.audio && status.audio.total > 0 && (
                <div className="sync-row" style={{ marginTop: 4, color: "var(--muted)" }}>
                  <span>
                    Audio: {status.audio.downloaded.toLocaleString("en-US")} /{" "}
                    {status.audio.total.toLocaleString("en-US")}
                  </span>
                  <span>
                    {status.audio.downloaded >= status.audio.total ? "Đủ" : "Đang tải"}
                  </span>
                </div>
              )}
            </Link>
          </div>
        </aside>

        <main className="canvas">{children}</main>
      </div>
    </>
  );
}
