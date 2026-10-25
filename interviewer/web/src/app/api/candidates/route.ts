import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DATA_DIR, store } from "@/lib/store";
import { background, HttpError, route } from "../_lib/http";
import { isMockMode, researchCandidate } from "@/lib/prep";

const MAX_PDF = 15 * 1024 * 1024;
const Fields = z.object({
  roleId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  githubHandle: z.string().trim().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, "Invalid GitHub handle").optional(),
});

async function readPdf(form: FormData, field: string, required: boolean): Promise<Buffer | null> {
  const f = form.get(field);
  if (!(f instanceof File) || f.size === 0) {
    if (required) throw new HttpError(400, `${field} (PDF) is required`);
    return null;
  }
  if (f.size > MAX_PDF) throw new HttpError(413, `${field} is larger than 15 MB`);
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(400, `${field} must be a PDF file`);
  return buf;
}

function parseLinks(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "links must be a JSON array of URLs");
  }
  const res = z.array(z.string().trim().url().max(500)).max(10).safeParse(v);
  if (!res.success) throw new HttpError(400, "links must be a JSON array of up to 10 valid URLs");
  return res.data.filter((u) => /^https?:\/\//i.test(u));
}

export const GET = route(async (req) => {
  const roleId = new URL(req.url).searchParams.get("roleId");
  const all = await store.candidates.list();
  return NextResponse.json({ candidates: roleId ? all.filter((c) => c.roleId === roleId) : all });
});

export const POST = route(async (req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected multipart/form-data");
  }
  const consent = String(form.get("consent") ?? "").toLowerCase();
  if (!["true", "1", "on", "yes"].includes(consent)) throw new HttpError(400, "Consent is required to continue");
  const gh = form.get("githubHandle");
  const parsed = Fields.safeParse({
    roleId: form.get("roleId"),
    name: form.get("name"),
    email: form.get("email"),
    githubHandle: typeof gh === "string" && gh.trim() ? gh.trim().replace(/^@/, "") : undefined,
  });
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const role = await store.roles.get(parsed.data.roleId);
  if (!role) throw new HttpError(404, "Role not found");
  const links = parseLinks(form.get("links"));
  const cv = await readPdf(form, "cv", true);
  const linkedin = await readPdf(form, "linkedin", false);

  // Paths are stored relative to DATA_DIR (servable at /api/files/<path>).
  const candidate = await store.candidates.create({
    roleId: role.id,
    name: parsed.data.name,
    email: parsed.data.email,
    cvPath: "",
    linkedinPdfPath: null,
    githubHandle: parsed.data.githubHandle ?? null,
    links,
    consentAt: new Date().toISOString(),
    research: "pending",
    profile: null,
    reviewedAt: null,
    ...(isMockMode() ? { demoData: true } : {}),
  });
  const dir = path.join(DATA_DIR, "uploads", candidate.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "cv.pdf"), cv!);
  if (linkedin) await fs.writeFile(path.join(dir, "linkedin.pdf"), linkedin);
  const saved = await store.candidates.update(candidate.id, {
    cvPath: `uploads/${candidate.id}/cv.pdf`,
    linkedinPdfPath: linkedin ? `uploads/${candidate.id}/linkedin.pdf` : null,
    research: "running",
  });

  background("research", async () => {
    const profile = await researchCandidate({ candidate: saved, role });
    await store.candidates.update(saved.id, { profile, research: "done" });
  }, async (message) => {
    await store.candidates.update(saved.id, { research: "failed", researchError: message });
  });
  return NextResponse.json({ candidate: saved }, { status: 201 });
});
