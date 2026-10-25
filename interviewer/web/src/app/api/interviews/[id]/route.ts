import { NextResponse } from "next/server";
import { type Ctx, loadInterview, route } from "../../_lib/http";

export const GET = route(async (_req, { params }: Ctx) => NextResponse.json(await loadInterview((await params).id)));
