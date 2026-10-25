import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { store } from "@/lib/store";
import { type Ctx, filesUrl, HttpError, requireInternal, route } from "../../../../_lib/http";

export const GET = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const iv = await store.interviews.get((await params).id);
  if (!iv) throw new HttpError(404, "Interview not found");
  const b = iv.board;
  const base = env("PUBLIC_BASE_URL").replace(/\/$/, "");
  return NextResponse.json({
    summary: b?.summary ?? "",
    padText: b?.padText ?? "",
    pngUrl: b?.pngPath ? `${filesUrl(b.pngPath, base)}?v=${Date.parse(b.updatedAt)}` : null,
  });
});
