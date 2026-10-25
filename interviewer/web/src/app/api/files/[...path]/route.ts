import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DATA_DIR } from "@/lib/store";
import { type Ctx, HttpError, route } from "../../_lib/http";

// db.json and anything else at the top of data/ is never served.
const ALLOWED_TOP = new Set(["uploads", "recordings", "boards"]);
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webm": "audio/webm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

async function resolveSafe(segments: string[]): Promise<string> {
  const parts = segments.map((s) => {
    let d: string;
    try {
      d = decodeURIComponent(s);
    } catch {
      throw new HttpError(400, "Bad path");
    }
    if (!d || d === "." || d === ".." || /[\\/\0]/.test(d)) throw new HttpError(400, "Bad path");
    return d;
  });
  if (parts.length < 2 || !ALLOWED_TOP.has(parts[0])) throw new HttpError(404, "Not found");
  const root = await fs.realpath(DATA_DIR).catch(() => DATA_DIR);
  const abs = path.resolve(root, ...parts);
  if (!abs.startsWith(root + path.sep)) throw new HttpError(400, "Bad path");
  // Resolve symlinks and re-check containment.
  const real = await fs.realpath(abs).catch(() => null);
  if (!real) throw new HttpError(404, "Not found");
  if (!real.startsWith(root + path.sep)) throw new HttpError(400, "Bad path");
  return real;
}

async function serve(req: Request, ctx: Ctx<{ path: string[] }>, head: boolean): Promise<Response> {
  const file = await resolveSafe((await ctx.params).path);
  const st = await fs.stat(file);
  if (!st.isFile()) throw new HttpError(404, "Not found");
  const headers: Record<string, string> = {
    "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=0, must-revalidate",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
  };
  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(st.size - Number(range[2]), 0);
    }
    if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${st.size}` } });
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${st.size}`;
  }
  headers["content-length"] = String(end - start + 1);
  if (head) return new Response(null, { status, headers });
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
  return new Response(body, { status, headers });
}

export const GET = route((req, ctx: Ctx<{ path: string[] }>) => serve(req, ctx, false));
export const HEAD = route((req, ctx: Ctx<{ path: string[] }>) => serve(req, ctx, true));
