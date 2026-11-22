import fs from "node:fs";
import path from "node:path";
import SettingsClient from "@/components/SettingsClient";
import { getCrawlStatus } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const status = getCrawlStatus();
  const authPath = path.join(process.cwd(), "data", "auth.json");
  let authJson = "[]";
  try {
    if (fs.existsSync(authPath)) {
      authJson = fs.readFileSync(authPath, "utf8");
    }
  } catch {}

  return <SettingsClient initialStatus={status} initialAuthJson={authJson} />;
}
