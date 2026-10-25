"use client";

import { useState } from "react";
import { Button, CatalogCard } from "@/components/ui";
import type { Claim, Candidate } from "@/lib/types";

function category(c: Claim): string {
  const k = c.source.kind;
  if (k === "github") return "OPEN SOURCE";
  if (k === "web") return "WEB LINK";
  const t = c.text.toLowerCase();
  if (/\b(led|lead|owned|managed|mentored|hired)\b/.test(t)) return "LEADERSHIP";
  if (/\b(degree|university|b\.?sc|m\.?sc|bachelor|master|ph\.?d|certified)\b/.test(t)) return "EDUCATION";
  if (k === "linkedin") return "PROFILE";
  return "EXPERIENCE";
}

function sourceLabel(c: Claim, candidate: Pick<Candidate, "githubHandle">): string {
  const { kind, page, url } = c.source;
  if (kind === "cv") return `FROM YOUR CV${page ? ` · P.${page}` : ""}`;
  if (kind === "linkedin") return `FROM YOUR LINKEDIN${page ? ` · P.${page}` : ""}`;
  if (kind === "github") return `FROM GITHUB${candidate.githubHandle ? ` · @${candidate.githubHandle}` : ""}`;
  try {
    return `FROM ${new URL(url ?? "").hostname.replace(/^www\./, "")}`;
  } catch {
    return "FROM YOUR LINKS";
  }
}

export function ClaimCard({
  claim,
  index,
  candidate,
  busy,
  onCorrect,
  onRemove,
  onRestore,
}: {
  claim: Claim;
  index: number;
  candidate: Pick<Candidate, "githubHandle">;
  busy: boolean;
  onCorrect: (text: string) => Promise<boolean>;
  onRemove: () => void;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(claim.text);
  const callNo = `C-${String(index + 1).padStart(2, "0")}`;
  const src = sourceLabel(claim, candidate);
  const labelId = `claim-${claim.id}`;

  if (claim.removedByCandidate) {
    return (
      <CatalogCard dashed callNo={callNo} kicker="REMOVED BY YOU" source={src} className="gap-1.5 opacity-90" aria-labelledby={labelId}>
        <p id={labelId} className="m-0 text-base leading-6 text-muted line-through">{claim.text}</p>
        <Button variant="secondary" className="my-1.5 self-start" disabled={busy} onClick={onRestore} aria-label={`Restore ${callNo}`}>Restore</Button>
      </CatalogCard>
    );
  }

  const quote = claim.source.quote;
  return (
    <CatalogCard ruled callNo={callNo} kicker={category(claim)} source={src} aria-labelledby={labelId}>
      {editing ? (
        <div className="flex flex-col gap-2 py-1.5">
          <label htmlFor={`${labelId}-edit`} className="text-sm leading-6 font-semibold">Correct this item</label>
          <textarea
            id={`${labelId}-edit`}
            rows={3}
            maxLength={2000}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-rule-strong bg-card px-3 py-2 text-base leading-6 text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              busy={busy}
              disabled={!draft.trim() || draft.trim() === claim.text}
              onClick={async () => {
                if (await onCorrect(draft.trim())) setEditing(false);
              }}
            >
              Save correction
            </Button>
            <Button variant="secondary" onClick={() => { setDraft(claim.text); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p id={labelId} className="m-0 text-base leading-6 font-medium">{claim.text}</p>
          {quote ? (
            <p className="m-0 font-mono text-[13px] leading-6 text-ink-2">
              {claim.source.kind === "cv" || claim.source.kind === "linkedin" ? `"${quote}"` : quote}
            </p>
          ) : null}
          {claim.source.url ? (
            <a href={claim.source.url} target="_blank" rel="noopener noreferrer" className="w-fit text-sm leading-6">
              Open source<span className="sr-only"> (new tab)</span>
            </a>
          ) : null}
          <div className="flex flex-wrap gap-2 py-1.5">
            <Button variant="secondary" disabled={busy} onClick={() => { setDraft(claim.text); setEditing(true); }} aria-label={`Correct ${callNo}`}>Correct</Button>
            <Button variant="secondary" disabled={busy} onClick={onRemove} aria-label={`Remove ${callNo}`}>Remove</Button>
          </div>
        </>
      )}
    </CatalogCard>
  );
}
