"use client";

import { useEffect, useMemo, useRef } from "react";
import { PhaseOutline, Stamp, type OutlineItem } from "@/components/ui";
import { callNo, mmss, roman } from "@/lib/format";
import { questionLabel } from "@/lib/questions";
import { phaseClock, resolveQuestion, type DeskState } from "./deskState";
import { PHASE_TITLE, type AiState, type RoomData, type TranscriptLine } from "./types";

const STATE_COPY: Record<AiState, { title: string; stamp: string; label: string }> = {
  connecting: { title: "Aperture is joining", stamp: "JOINING", label: "Aperture, the AI interviewer, is joining" },
  failed: { title: "Aperture could not join", stamp: "OFFLINE", label: "Aperture, the AI interviewer, could not join" },
  idle: { title: "Aperture is here", stamp: "READY", label: "Aperture, the AI interviewer, is ready" },
  listening: { title: "Aperture is listening", stamp: "LISTENING", label: "Aperture, the AI interviewer, is listening" },
  thinking: { title: "Aperture is thinking", stamp: "THINKING", label: "Aperture, the AI interviewer, is thinking" },
  speaking: { title: "Aperture is speaking", stamp: "SPEAKING", label: "Aperture, the AI interviewer, is speaking" },
};

/** The violet stamp mark. State changes land like a stamp press; the mark itself never animates otherwise. */
export function AiPresence({ state }: { state: AiState }) {
  const c = STATE_COPY[state];
  const hollow = state === "listening";
  return (
    <div className="flex items-center gap-4 border-b border-rule px-6 py-5">
      <span key={state} className="stamp-press inline-flex shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={c.label}>
          <circle cx="32" cy="32" r="29" fill="none" stroke="#5A4AA8" strokeWidth="2" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="#5A4AA8" strokeWidth="1" strokeDasharray={state === "thinking" ? "1.5 4.5" : "3 3"} />
          {hollow ? <circle cx="32" cy="32" r="12" fill="#FFFFFF" stroke="#5A4AA8" strokeWidth="2" /> : <circle cx="32" cy="32" r="13" fill="#5A4AA8" />}
          <path d="M27 32h10M32 27v10" stroke={hollow ? "#5A4AA8" : "#FFFFFF"} strokeWidth="1.6" />
        </svg>
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-semibold">{c.title}</span>
        <span className="text-[13px] leading-[18px] text-muted">AI interviewer · not a person · cannot make the decision</span>
        <Stamp variant="ai" pressKey={state} className="mt-0.5">
          {c.stamp}
        </Stamp>
      </div>
    </div>
  );
}

/** Finding-aid outline built from the plan, driven by desk "phase" and "question" messages. */
export function Outline({ data, desk, now }: { data: RoomData; desk: DeskState; now: number }) {
  const resolved = resolveQuestion(data, desk);
  const items: OutlineItem[] = useMemo(() => {
    const cur = desk.phase ? Math.min(desk.phase.index, data.plan.phases.length - 1) : -1;
    const clock = phaseClock(data, desk, now);
    return data.plan.phases.map((p, i) => {
      const state: OutlineItem["state"] = i < cur ? "done" : i === cur ? "current" : "upcoming";
      const subs = state === "current" ? p.questions.map((q, qi) => {
        const tag = questionLabel(data.plan, q.id) ?? callNo.question(i + 1, qi + 1);
        const name = (q.competencyId && data.criterionNames[q.competencyId]) || (q.skillId && data.criterionNames[q.skillId]) || (q.kind === "probe" ? "Probe" : "Core question");
        const isNow = resolved?.planned?.id === q.id;
        const src = q.source && q.kind === "probe" ? ` · probe on ${q.source.kind === "cv" ? "CV" : q.source.kind === "github" ? "repo" : q.source.kind}` : "";
        return { id: q.id, current: isNow, label: isNow ? `${tag} ${name}${src}` : `${tag} ${name}` };
      }) : undefined;
      return {
        id: `${p.phase}-${i}`,
        numeral: roman(i + 1),
        label: PHASE_TITLE[p.phase],
        state,
        readout: state === "done" ? "done" : state === "current" ? (clock ? `${mmss(clock.elapsed)} / ${mmss(clock.total)}` : `${p.minutes} min`) : `${p.minutes} min`,
        subs,
      };
    });
  }, [data, desk, now, resolved?.planned?.id]);
  return (
    <div className="border-b border-rule px-6 py-[18px]">
      <PhaseOutline items={items} />
    </div>
  );
}

/** Typed transcript. One 14px size: rank comes from weight, case and tint. */
export function Transcript({ lines, className = "" }: { lines: TranscriptLine[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const last = lines[lines.length - 1];
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <section aria-label="Live transcript" className={`flex min-h-0 flex-1 flex-col gap-3 px-6 py-[18px] text-sm leading-[21px] ${className}`}>
      <h2 className="m-0 font-mono text-xs font-normal tracking-[0.12em] text-muted">TRANSCRIPT</h2>
      <div ref={box} role="log" aria-live="off" tabIndex={0} className="room-scroll flex max-h-[320px] min-h-[140px] flex-1 flex-col gap-3 overflow-y-auto lg:max-h-none">
        {lines.length === 0 ? (
          <p className="m-0 text-muted">Words appear here as they are spoken. Nothing is said that is not typed.</p>
        ) : (
          lines.map((l) => {
            const current = l === last && l.who === "agent";
            const interim = l === last && l.who === "candidate" && !l.final;
            return (
              <div
                key={l.id}
                className={current ? "bg-stamp-tint px-2.5 py-1.5" : interim ? "text-muted" : undefined}
              >
                <span className="font-mono text-muted">{mmss(l.at)}</span>{" "}
                <b className={`tracking-[0.04em] ${l.who === "agent" ? "text-stamp" : ""}`}>{l.who === "agent" ? "APERTURE" : "YOU"}</b>{" "}
                <span>{l.text}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
