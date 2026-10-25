import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { type Ctx, filesUrl, loadInterview, requireInternal, route } from "../../../../_lib/http";

export const GET = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { interview, role, candidate } = await loadInterview((await params).id);
  const publicBaseUrl = env("PUBLIC_BASE_URL").replace(/\/$/, "");
  return NextResponse.json({ interview, role, candidate, cvUrl: candidate.cvPath ? filesUrl(candidate.cvPath, publicBaseUrl) : null, publicBaseUrl });
});
