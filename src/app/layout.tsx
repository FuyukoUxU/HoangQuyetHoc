import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getCrawlStatus } from "@/lib/data";

export const metadata: Metadata = {
  title: "IELTS Ledger — Kho đề IELTS 4 kỹ năng",
  description: "Hệ thống tự luyện đề IELTS Reading, Listening, Writing, Speaking và Full Simulation Test ngoại tuyến.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialStatus = getCrawlStatus();

  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell initialStatus={initialStatus}>{children}</AppShell>
      </body>
    </html>
  );
}
