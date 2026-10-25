import type { Candidate, Interview, Role, RoleProfile, IntegritySignal } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error;
    throw new ApiError(res.status, msg ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  roles: {
    list: () => request<{ roles: Role[] }>("/api/roles").then((r) => r.roles),
    get: (id: string) => request<{ role: Role }>(`/api/roles/${id}`).then((r) => r.role),
    create: (input: { title: string; company: string; jdText: string }) =>
      request<{ role: Role }>("/api/roles", json("POST", input)).then((r) => r.role),
    patch: (id: string, patch: { title?: string; company?: string; profile?: RoleProfile }) =>
      request<{ role: Role }>(`/api/roles/${id}`, json("PATCH", patch)).then((r) => r.role),
    approve: (id: string) => request<{ role: Role }>(`/api/roles/${id}/approve`, { method: "POST" }).then((r) => r.role),
  },
  candidates: {
    list: (roleId?: string) =>
      request<{ candidates: Candidate[] }>(`/api/candidates${roleId ? `?roleId=${encodeURIComponent(roleId)}` : ""}`).then((r) => r.candidates),
    get: (id: string) =>
      request<{ candidate: Candidate; research: Candidate["research"]; researchError: string | null; profile: Candidate["profile"] }>(`/api/candidates/${id}`),
    /** Multipart: pass a FormData with roleId, name, email, links (JSON string), githubHandle?, consent, cv, linkedin?. */
    create: (form: FormData) => request<{ candidate: Candidate }>("/api/candidates", { method: "POST", body: form }).then((r) => r.candidate),
    patch: (
      id: string,
      patch: { removeClaimIds?: string[]; restoreClaimIds?: string[]; corrections?: { claimId: string; text: string }[]; reviewed?: boolean },
    ) => request<{ candidate: Candidate }>(`/api/candidates/${id}`, json("PATCH", patch)).then((r) => r.candidate),
  },
  interviews: {
    list: () => request<{ interviews: Interview[] }>("/api/interviews").then((r) => r.interviews),
    get: (id: string) => request<{ interview: Interview; role: Role; candidate: Candidate }>(`/api/interviews/${id}`),
    create: (candidateId: string) => request<{ interview: Interview }>("/api/interviews", json("POST", { candidateId })).then((r) => r.interview),
    token: (id: string, as: "candidate" | "board" | "bridge") =>
      request<{ token: string; url: string }>(`/api/interviews/${id}/token`, json("POST", { as })),
    meet: (id: string, meetUrl: string) =>
      request<{ interview: Interview; botId: string }>(`/api/interviews/${id}/meet`, json("POST", { meetUrl })),
    recording: (id: string, audio: Blob, opts?: { offsetSec?: number; recordingStartedAt?: string }) => {
      const form = new FormData();
      form.set("audio", audio, "recording.webm");
      if (opts?.offsetSec !== undefined) form.set("offsetSec", String(opts.offsetSec));
      if (opts?.recordingStartedAt) form.set("recordingStartedAt", opts.recordingStartedAt);
      return request<{ recording: NonNullable<Interview["recording"]> }>(`/api/interviews/${id}/recording`, { method: "POST", body: form });
    },
    board: (id: string, state: { summary: string; padText: string; png?: string }) =>
      request<{ ok: true; updatedAt: string }>(`/api/interviews/${id}/board`, json("POST", state)),
    integrity: (id: string, signal: IntegritySignal) => request<{ ok: true }>(`/api/interviews/${id}/integrity`, json("POST", { signal })),
  },
  /** Public URL for a file under data/ (CV for PDF.js, recordings, board PNGs). */
  fileUrl: (path: string) => `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`,
};
