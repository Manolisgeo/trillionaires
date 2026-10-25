import fs from "node:fs/promises";
import path from "node:path";

// The PDF.js worker (pdfjs-dist 6.3.289, the version react-pdf 11 pins) served untouched from our own origin.
// pnpm does not hoist pdfjs-dist, and letting the bundler import the file runs it through SWC, which breaks it.
// Stored with a .txt suffix so ESLint and the bundler leave the minified file alone.
const FILE = path.join(process.cwd(), "src/app/room/pdfjs-worker/pdf.worker.min.mjs.txt");
let cached: Promise<Buffer> | null = null;

export async function GET() {
  cached ??= fs.readFile(FILE);
  try {
    const body = await cached;
    return new Response(new Uint8Array(body), {
      headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    cached = null;
    return new Response("PDF worker file is missing", { status: 500 });
  }
}
