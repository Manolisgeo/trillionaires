"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button, Cataloguing, DemoLabel, ErrorNote, SeriesHeading } from "@/components/ui";
import { CopyButton, OriginLink } from "./CopyButton";
import { PageTitle } from "./Shell";
import { roleStamp } from "./status";
import { api } from "@/lib/client";
import { callNo } from "@/lib/format";
import type { Role, RoleProfile } from "@/lib/types";

const area =
  "w-full resize-y rounded-[3px] border border-rule-strong bg-card px-2.5 py-2 text-sm leading-[21px] text-ink";

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d={dir === "up" ? "M3 9l4-4 4 4" : "M3 5l4 4 4-4"} />
    </svg>
  );
}

function MoveButton({ dir, disabled, onClick, label }: { dir: "up" | "down"; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-rule-strong bg-card text-ink hover:border-ink-2 hover:bg-board disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Chevron dir={dir} />
    </button>
  );
}

export function RoleEditor({ initial }: { initial: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initial);
  const [profile, setProfile] = useState<RoleProfile | null>(initial.profile);
  const [saved, setSaved] = useState<string>(JSON.stringify(initial.profile));
  const [busy, setBusy] = useState<null | "save" | "approve" | "redraft">(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Poll while the cataloguer is drafting.
  useEffect(() => {
    if (role.status !== "drafting") return;
    const t = setInterval(async () => {
      try {
        const r = await api.roles.get(role.id);
        if (r.status !== "drafting") {
          setRole(r);
          setProfile(r.profile);
          setSaved(JSON.stringify(r.profile));
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [role.status, role.id]);

  const dirty = profile !== null && JSON.stringify(profile) !== saved;
  const edit = (fn: (p: RoleProfile) => RoleProfile) => setProfile((p) => (p ? fn(p) : p));

  async function save(): Promise<boolean> {
    if (!profile) return false;
    setBusy("save");
    setErr(null);
    try {
      const r = await api.roles.patch(role.id, { profile });
      setRole(r);
      setSaved(JSON.stringify(profile));
      setNote(role.status === "approved" ? "Saved. Editing an approved rubric sends it back to draft: approve it again." : "Saved.");
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (dirty && !(await save())) return;
    setBusy("approve");
    setErr(null);
    try {
      const r = await api.roles.approve(role.id);
      setRole(r);
      setNote("Rubric approved. The application link is ready below.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusy(null);
    }
  }

  async function redraft() {
    if (dirty && !window.confirm("Redrafting creates a new draft from the job description. Your unsaved edits stay on this page only. Continue?")) return;
    setBusy("redraft");
    setErr(null);
    try {
      const r = await api.roles.create({ title: role.title, company: role.company, jdText: role.jdText });
      router.push(`/roles/${r.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start a new draft");
      setBusy(null);
    }
  }

  const drafting = role.status === "drafting";
  const failed = !drafting && !profile;
  const compIndex = (id: string) => (profile?.competencies.findIndex((c) => c.id === id) ?? -1) + 1;

  function moveQ(i: number, d: -1 | 1) {
    edit((p) => {
      const q = [...p.coreQuestions];
      [q[i], q[i + d]] = [q[i + d], q[i]];
      return { ...p, coreQuestions: q };
    });
  }

  return (
    <>
      <PageTitle
        tag={`${callNo.role(role.id)} · ${role.company}`}
        title={role.title}
        actions={
          <>
            <Button variant="secondary" onClick={redraft} busy={busy === "redraft"} disabled={drafting}>
              Redraft
            </Button>
            {profile && dirty ? (
              <Button variant="secondary" onClick={save} busy={busy === "save"}>
                Save changes
              </Button>
            ) : null}
            <Button onClick={approve} busy={busy === "approve"} disabled={drafting || !profile || (role.status === "approved" && !dirty)}>
              {role.status === "approved" && !dirty ? "Rubric approved" : "Approve rubric"}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {roleStamp(role.status)}
        {role.demoData ? <DemoLabel /> : null}
        <span role="status" className="text-sm text-ink-2">
          {note}
        </span>
      </div>
      {err ? <ErrorNote title="That did not go through">{err}</ErrorNote> : null}

      {role.status === "approved" ? (
        <section aria-label="Candidate application link" className="flex flex-col gap-3 border border-rule bg-card px-5 py-4">
          <SeriesHeading as="h2">Candidate application link</SeriesHeading>
          <p className="m-0 max-w-[65ch] text-sm leading-[21px] text-ink">Send this link to applicants. They upload a CV and links, review what Kimma gathered, then join their interview.</p>
          <div className="flex flex-wrap items-center gap-4">
            <OriginLink path={`/apply/${role.id}`} />
            <CopyButton path={`/apply/${role.id}`} label="Copy application link" />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-start gap-7">
        <section
          aria-label="Job description"
          className="flex max-w-[420px] min-w-[min(100%,340px)] flex-[1_1_340px] flex-col gap-2.5 border border-rule bg-card px-[26px] py-6 text-sm leading-[22px] shadow-sheet"
        >
          <span className="font-mono text-xs tracking-[0.12em] text-muted">SOURCE DOCUMENT · JOB DESCRIPTION</span>
          {role.jdText.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="m-0 whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </section>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {drafting ? (
            <div className="flex flex-col gap-2 border border-dashed border-rule-strong bg-card px-6 py-8">
              <Cataloguing label="Cataloguing the job description" />
              <p className="m-0 max-w-[62ch] text-sm text-ink-2">Kimma is reading the job description and drafting competencies, anchors and core questions. This page updates by itself.</p>
            </div>
          ) : null}

          {failed ? (
            <ErrorNote
              title="The draft failed"
              action={
                <div>
                  <Button variant="secondary" size={40} onClick={redraft} busy={busy === "redraft"}>
                    Redraft
                  </Button>
                </div>
              }
            >
              {role.draftError ?? "The drafter returned no profile."} Redrafting starts a fresh draft from the same job description.
            </ErrorNote>
          ) : null}

          {profile ? (
            <>
              <section aria-label="Summary" className="flex flex-col gap-1.5 text-sm leading-[21px]">
                <p className="m-0 max-w-[70ch]">{profile.summary}</p>
                <p className="m-0 font-mono text-[13px] text-muted">Level: {profile.level}</p>
              </section>

              <section aria-label="Competencies" className="flex flex-col border border-rule bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-5 py-3.5">
                  <h2 className="m-0 font-mono text-[13px] font-bold tracking-[0.14em]">COMPETENCIES AND ANCHORS</h2>
                  <span className="text-[13px] text-muted">Drafted by AI. Edit any anchor, then approve.</span>
                </div>
                {profile.competencies.map((c, ci) => (
                  <Competency
                    key={c.id}
                    n={ci + 1}
                    c={c}
                    onAnchor={(k, v) => edit((p) => ({ ...p, competencies: p.competencies.map((x) => (x.id === c.id ? { ...x, anchors: { ...x.anchors, [k]: v } } : x)) }))}
                  />
                ))}
              </section>

              <section aria-label="Core questions" className="flex flex-col border border-rule bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-5 py-3.5">
                  <h2 className="m-0 font-mono text-[13px] font-bold tracking-[0.14em]">CORE QUESTIONS · SAME FOR EVERY CANDIDATE</h2>
                  <span className="text-[13px] text-muted">Personal probes are added per candidate</span>
                </div>
                <ol className="m-0 flex list-none flex-col p-0 text-sm leading-[21px]">
                  {profile.coreQuestions.map((q, i) => (
                    <li key={q.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-rule-faint px-5 py-3 last:border-b-0">
                      <span className="pt-2 font-mono text-muted">Q{i + 1}</span>
                      <div className="flex min-w-[min(100%,260px)] flex-1 flex-col gap-2">
                        <QuestionText
                          label={`Question ${i + 1} text`}
                          value={q.text}
                          onChange={(v) => edit((p) => ({ ...p, coreQuestions: p.coreQuestions.map((x) => (x.id === q.id ? { ...x, text: v } : x)) }))}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                          <label htmlFor={`map-${q.id}`} className="font-mono text-muted">
                            MAPS TO
                          </label>
                          <select
                            id={`map-${q.id}`}
                            value={q.competencyId}
                            onChange={(e) => edit((p) => ({ ...p, coreQuestions: p.coreQuestions.map((x) => (x.id === q.id ? { ...x, competencyId: e.target.value } : x)) }))}
                            className="min-h-11 max-w-full rounded-[3px] border border-rule-strong bg-card px-2 text-sm text-ink"
                          >
                            {profile.competencies.map((c, ci) => (
                              <option key={c.id} value={c.id}>
                                {ci + 1} · {c.name}
                              </option>
                            ))}
                          </select>
                          <span className="font-mono text-stamp">→ {compIndex(q.competencyId) || "?"}</span>
                        </div>
                        {q.followUps.length ? (
                          <ul className="m-0 list-none p-0 text-[13px] text-muted">
                            {q.followUps.map((f, fi) => (
                              <li key={fi}>Follow-up: {f}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <MoveButton dir="up" label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => moveQ(i, -1)} />
                        <MoveButton dir="down" label={`Move question ${i + 1} down`} disabled={i === profile.coreQuestions.length - 1} onClick={() => moveQ(i, 1)} />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section aria-label="Technical topics" className="flex flex-col gap-2 border border-rule bg-card px-5 py-4 text-sm leading-[21px]">
                  <SeriesHeading>TECHNICAL TOPICS</SeriesHeading>
                  {profile.technicalTopics.length === 0 ? <p className="m-0 text-muted">None drafted.</p> : null}
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {profile.technicalTopics.map((t) => (
                      <li key={t.id}>
                        <b>{t.name}</b> <span className="font-mono text-[13px] text-muted">{t.difficulty}</span>
                        {t.probes.length ? <div className="text-ink-2">{t.probes.join(" · ")}</div> : null}
                      </li>
                    ))}
                  </ul>
                </section>
                <section aria-label="Board problems" className="flex flex-col gap-2 border border-rule bg-card px-5 py-4 text-sm leading-[21px]">
                  <SeriesHeading>BOARD PROBLEMS</SeriesHeading>
                  {profile.problems.length === 0 ? <p className="m-0 text-muted">None drafted.</p> : null}
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {profile.problems.map((p) => (
                      <li key={p.id} className="flex flex-col gap-1">
                        <b>{p.title}</b>
                        <span>{p.prompt}</span>
                        <span className="text-[13px] text-muted">Good answer: {p.goodAnswerLooksLike}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section aria-label="Guardrails" className="flex flex-col gap-1.5 border border-dashed border-rule-strong px-5 py-3.5 text-sm leading-[21px]">
                <span className="font-mono text-xs tracking-[0.12em] text-muted">GUARDRAILS · KIMMA WILL NEVER ASK ABOUT</span>
                {profile.guardrailNotes.length ? (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {profile.guardrailNotes.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">No guardrails drafted. Redraft before approving.</span>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Competency({ n, c, onAnchor }: { n: number; c: RoleProfile["competencies"][number]; onAnchor: (k: "weak" | "ok" | "strong", v: string) => void }) {
  return (
    <article className="flex flex-col gap-2.5 border-b border-rule-faint px-5 py-4 text-sm leading-[21px] last:border-b-0">
      <div className="flex flex-wrap justify-between gap-3">
        <span>
          <span className="font-mono text-muted">{`C-${String(n).padStart(2, "0")}`}</span>{" "}
          <b className="tracking-[0.06em] uppercase">{c.name}</b>
        </span>
        <span className="font-mono text-muted">weight {c.weight}</span>
      </div>
      <p className="m-0 text-ink-2">{c.description}</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {(["weak", "ok", "strong"] as const).map((k) => (
          <Anchor key={k} label={k.toUpperCase()} value={c.anchors[k]} onChange={(v) => onAnchor(k, v)} name={c.name} />
        ))}
      </div>
    </article>
  );
}

function Anchor({ label, value, onChange, name }: { label: string; value: string; onChange: (v: string) => void; name: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs text-muted">
        {label}
        <span className="sr-only"> anchor for {name}</span>
      </label>
      <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={area} />
    </div>
  );
}

function QuestionText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): ReactNode {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={area} />
    </>
  );
}
