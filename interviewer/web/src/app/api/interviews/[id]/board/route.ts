import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DATA_DIR, store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, route } from "../../../_lib/http";

const Body = z.object({
  summary: z.string().max(20000),
  padText: z.string().max(100000),
  png: z.string().max(12_000_000).optional(),
});

export const POST = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const body = await parseJson(req, Body);
  const iv = await store.interviews.get(id);
  if (!iv) throw new HttpError(404, "Interview not found");
  let pngPath = iv.board?.pngPath ?? null;
  if (body.png) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.png);
    if (!m) throw new HttpError(400, "png must be a base64 PNG data URL");
    await fs.mkdir(path.join(DATA_DIR, "boards"), { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, "boards", `${id}.png`), Buffer.from(m[1], "base64"));
    pngPath = `boards/${id}.png`;
  }
  const board = { summary: body.summary, padText: body.padText, pngPath, updatedAt: new Date().toISOString() };
  await store.interviews.update(id, { board });
  return NextResponse.json({ ok: true, updatedAt: board.updatedAt });
});
