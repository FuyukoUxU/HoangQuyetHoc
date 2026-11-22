import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serveLocalFile(filePath: string, rangeHeader: string | null) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1;
      if (start <= end && start < fileSize) {
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }
  }

  const stream = fs.createReadStream(filePath);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cleanId = id.replace(/\.mp3$/i, "").toLowerCase();
  if (!UUID_RE.test(cleanId)) {
    return NextResponse.json({ error: "Invalid audio ID" }, { status: 400 });
  }

  const localPath = path.join(AUDIO_DIR, `${cleanId}.mp3`);
  const rangeHeader = req.headers.get("range");

  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    return serveLocalFile(localPath, rangeHeader);
  }

  // On-demand fallback: download & cache locally if background crawler hasn't reached it yet
  try {
    const upstream = await fetch(`https://cms.youpass.vn/assets/${cleanId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Audio not found" }, { status: upstream.status });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    const tmpPath = `${localPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, localPath);
    return serveLocalFile(localPath, rangeHeader);
  } catch {
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 502 });
  }
}
