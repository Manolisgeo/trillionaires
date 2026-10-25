"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

type Choice = "advance" | "hold" | "decline";
interface Saved { choice: Choice; note: string; at: string }
const LABEL: Record<Choice, string> = { advance: "Advance", hold: "Hold", decline: "Decline" };

/** Demo only: the decision is kept in this browser's localStorage. There is no decision endpoint yet (see NOTES-ui-report.md). */
export function Decision({ interviewId, open, onClose }: { interviewId: string; open: boolean; onClose: () => void }) {
  const key = `aperture:decision:${interviewId}`;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSaved(JSON.parse(raw) as Saved);
    } catch {
      /* storage unavailable */
    }
  }, [key]);

  function save() {
    if (!choice) return;
    const rec: Saved = { choice, note: note.trim(), at: new Date().toISOString() };
    setSaved(rec);
    try {
      localStorage.setItem(key, JSON.stringify(rec));
    } catch {
      /* demo only */
    }
    onClose();
  }

  return (
    <>
      {saved ? (
        <p className="m-0 w-full border-t border-rule pt-3 text-sm leading-[21px]" role="status">
          <span className="font-mono text-xs tracking-[0.12em] text-muted">DECISION RECORDED BY A PERSON · </span>
          <b>{LABEL[saved.choice]}</b>
          <span className="text-muted"> · {formatDateTime(saved.at)} · saved in this browser only</span>
          {saved.note ? <span className="block text-ink-2">&ldquo;{saved.note}&rdquo;</span> : null}
        </p>
      ) : null}
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex w-full flex-col gap-3 border-t border-rule pt-4"
        >
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="mb-2 font-mono text-xs tracking-[0.12em] text-muted">YOUR DECISION</legend>
            {(Object.keys(LABEL) as Choice[]).map((c) => (
              <label
                key={c}
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-stamp",
                  choice === c ? "border-ink bg-ink font-semibold text-white" : "border-rule-strong bg-card text-ink hover:border-ink-2",
                )}
              >
                <input type="radio" name="decision" value={c} checked={choice === c} onChange={() => setChoice(c)} className="sr-only" />
                {LABEL[c]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              className="rounded-md border border-rule-strong bg-card px-3 py-2 text-sm leading-[21px] text-ink"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!choice}>
              Save decision
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
