import { NextResponse } from "next/server";

export function requireAgentAuth(request: Request): NextResponse | null {
  const expected = process.env.AGENT_INTERNAL_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
