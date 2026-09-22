import { NextResponse } from "next/server";
import { requireAgentAuth } from "@/server/agent-auth";
import { processDueJobs } from "@/server/jobs";

export async function POST(request: Request) {
  const unauthorized = requireAgentAuth(request);
  if (unauthorized) return unauthorized;
  const ran = await processDueJobs(10);
  return NextResponse.json({ ran });
}
