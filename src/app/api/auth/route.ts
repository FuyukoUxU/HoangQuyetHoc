import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authPath = path.join(process.cwd(), "data", "auth.json");
    fs.mkdirSync(path.dirname(authPath), { recursive: true });

    if (body.cookiesJson) {
      const parsed = typeof body.cookiesJson === "string" ? JSON.parse(body.cookiesJson) : body.cookiesJson;
      if (!Array.isArray(parsed)) {
        return NextResponse.json({ error: "Cookie JSON phải là một mảng []" }, { status: 400 });
      }
      fs.writeFileSync(authPath, JSON.stringify(parsed, null, 2));
    }

    if (body.runCrawl) {
      const child = spawn(process.execPath, ["scripts/crawl.mjs"], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    if (body.runAudioCrawl) {
      const child = spawn(process.execPath, ["scripts/crawl-audio.mjs"], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid payload" }, { status: 400 });
  }
}
