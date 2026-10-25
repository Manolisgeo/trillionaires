import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { env } from "@/lib/env";
import { store } from "@/lib/store";
import type { Candidate, Interview, Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Ctx<P extends Record<string, string | string[]> = { id: string }> = { params: Promise<P> };

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a handler: HttpError -> its status, anything else -> 500, always JSON. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
  const res = schema.safeParse(body);
  if (!res.success) {
    throw new HttpError(400, res.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  return res.data;
}

export function requireInternal(req: Request): void {
  const secret = env("AGENT_INTERNAL_SECRET");
  if (!secret) throw new HttpError(503, "AGENT_INTERNAL_SECRET is not set; internal routes are disabled.");
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  const a = Buffer.from(m?.[1] ?? "");
  const b = Buffer.from(secret);
  if (!m || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Unauthorized");
}

export async function loadInterview(id: string): Promise<{ interview: Interview; role: Role; candidate: Candidate }> {
  const interview = await store.interviews.get(id);
  if (!interview) throw new HttpError(404, "Interview not found");
  const [role, candidate] = await Promise.all([store.roles.get(interview.roleId), store.candidates.get(interview.candidateId)]);
  if (!role || !candidate) throw new HttpError(404, "Interview's role or candidate is missing");
  return { interview, role, candidate };
}

export const filesUrl = (relPath: string, base = ""): string => `${base}/api/files/${relPath.split("/").map(encodeURIComponent).join("/")}`;

/** Fire-and-forget; failures go to `onError` (which writes them to the record) and the log, never to the caller. */
export function background(label: string, work: () => Promise<void>, onError: (message: string) => Promise<void>): void {
  void (async () => {
    try {
      await work();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[background:${label}]`, e);
      try {
        await onError(message);
      } catch (e2) {
        console.error(`[background:${label}] could not record error`, e2);
      }
    }
  })();
}
