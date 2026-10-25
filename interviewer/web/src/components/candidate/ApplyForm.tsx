"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Button, Checkbox, ErrorNote, FileInput, Input, SeriesHeading } from "@/components/ui";

const MAX_PDF = 15 * 1024 * 1024;
type Errors = Partial<Record<"name" | "email" | "cv" | "linkedin" | "github" | "consent" | "links", string>>;
interface LinkRow { key: number; value: string }

function pdfProblem(file: File | undefined, label: string, required: boolean): string | undefined {
  if (!file) return required ? `Add your ${label} as a PDF.` : undefined;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return `${label} must be a PDF file.`;
  if (file.size > MAX_PDF) return `${label} is larger than 15 MB. Export a smaller PDF.`;
  return undefined;
}

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export function ApplyForm({ roleId, role, company }: { roleId: string; role: string; company: string }) {
  const router = useRouter();
  const nextKey = useRef(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([{ key: 1, value: "" }]);
  const [consent, setConsent] = useState(false);
  const [cv, setCv] = useState<File | undefined>();
  const [linkedin, setLinkedin] = useState<File | undefined>();
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter an email address like name@example.com.";
    next.cv = pdfProblem(cv, "CV", true);
    next.linkedin = pdfProblem(linkedin, "LinkedIn export", false);
    const handle = github.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "");
    if (handle && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(handle)) next.github = "Use just your handle, for example mokafor.";
    const urls: string[] = [];
    for (const row of links) {
      const u = normalizeUrl(row.value);
      if (u === null) next.links = `"${row.value.trim()}" does not look like a web address.`;
      else if (u) urls.push(u);
    }
    if (!consent) next.consent = "Tick the box to confirm you have read this and agree.";
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Errors;
    setErrors(clean);
    if (Object.keys(clean).length) {
      document.getElementById(`apply-${Object.keys(clean)[0]}`)?.focus();
      return;
    }

    const form = new FormData();
    form.set("roleId", roleId);
    form.set("name", name.trim());
    form.set("email", email.trim());
    form.set("links", JSON.stringify(urls));
    if (handle) form.set("githubHandle", handle);
    form.set("consent", "true");
    form.set("cv", cv!);
    if (linkedin) form.set("linkedin", linkedin);
    setBusy(true);
    try {
      const c = await api.candidates.create(form);
      router.push(`/apply/review/${c.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-9">
      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-4 p-0"><SeriesHeading as="span">About you</SeriesHeading></legend>
        <Input id="apply-name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input id="apply-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} hint={`${company} will use this to contact you about ${role}.`} />
      </fieldset>

      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-4 p-0"><SeriesHeading as="span">Documents</SeriesHeading></legend>
        <FileInput id="apply-cv" label="CV (PDF, required)" accept="application/pdf,.pdf" onChange={(e) => setCv(e.target.files?.[0])} error={errors.cv} hint="Up to 15 MB." />
        <FileInput
          id="apply-linkedin"
          label="LinkedIn export (PDF, optional)"
          accept="application/pdf,.pdf"
          onChange={(e) => setLinkedin(e.target.files?.[0])}
          error={errors.linkedin}
          hint="On your LinkedIn profile choose More, then Save to PDF."
        />
      </fieldset>

      <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="mb-4 p-0"><SeriesHeading as="span">Links</SeriesHeading></legend>
        <Input id="apply-github" label="GitHub handle (optional)" placeholder="mokafor" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={github} onChange={(e) => setGithub(e.target.value)} error={errors.github} hint="We read only your public repositories." />
        <div id="apply-links" tabIndex={-1} className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink">Personal links (optional)</span>
          <p className="m-0 text-[13px] text-muted">A personal site, blog, talk or portfolio. We read these pages and nothing else on the web.</p>
          {links.map((row, i) => (
            <div key={row.key} className="flex items-start gap-2">
              <input
                aria-label={`Personal link ${i + 1}`}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={row.value}
                onChange={(e) => setLinks((rs) => rs.map((r) => (r.key === row.key ? { ...r, value: e.target.value } : r)))}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-rule-strong bg-card px-3 text-[15px] text-ink"
              />
              <Button variant="secondary" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks((rs) => (rs.length === 1 ? [{ key: row.key, value: "" }] : rs.filter((r) => r.key !== row.key)))}>
                Remove
              </Button>
            </div>
          ))}
          {errors.links ? <p role="alert" className="m-0 text-[13px] font-semibold text-[#A8322A]">{errors.links}</p> : null}
          {links.length < 10 ? (
            <Button variant="secondary" className="self-start" onClick={() => setLinks((rs) => [...rs, { key: nextKey.current++, value: "" }])}>
              Add another link
            </Button>
          ) : null}
        </div>
      </fieldset>

      <section aria-labelledby="consent-h" className="flex flex-col gap-4 border border-rule bg-card px-5 py-5 sm:px-6">
        <SeriesHeading as="h2" className="" >
          <span id="consent-h">Before you continue</span>
        </SeriesHeading>
        <ul className="m-0 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-sm leading-[22px] text-ink-2">
          <li><b className="text-ink">What we read.</b> Your CV, your LinkedIn export if you add one, your public GitHub repositories, and the links you list here. We do not search the web for you beyond these.</li>
          <li><b className="text-ink">An AI interviews you.</b> The interviewer is Kimma, an AI. It is not a person and says so at the start.</li>
          <li><b className="text-ink">Recorded and captioned.</b> The interview is recorded, and live captions are shown throughout.</li>
          <li><b className="text-ink">A person decides.</b> A person at {company} reads the report and makes the decision. The AI never rejects anyone.</li>
          <li><b className="text-ink">You can ask for a human.</b> You can ask for a human interviewer instead, before the interview starts.</li>
          <li><b className="text-ink">How long we keep it.</b> Your documents, recording and transcript are kept only for the hiring decision on this role. You can ask {company} to delete them at any time.</li>
        </ul>
        <div>
          <Checkbox
            id="apply-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "consent-err" : undefined}
            label="I have read this and agree to the interview being recorded and my documents being read."
          />
          {errors.consent ? <p id="consent-err" role="alert" className="mt-1.5 mb-0 pl-8 text-[13px] font-semibold text-[#A8322A]">{errors.consent}</p> : null}
        </div>
      </section>

      {submitError ? <ErrorNote title="We couldn't submit your application">{submitError}</ErrorNote> : null}
      <div className="flex flex-col gap-2">
        <Button type="submit" size={48} busy={busy} className="w-full sm:w-auto sm:self-start">
          {busy ? "Sending your documents…" : "Continue to review your record"}
        </Button>
        <p className="m-0 text-[13px] text-muted">Next you will see everything we read, before any interview begins.</p>
      </div>
    </form>
  );
}
