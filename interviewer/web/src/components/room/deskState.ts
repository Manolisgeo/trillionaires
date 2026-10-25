import type { DeskMsg, SimpleShape } from "@/lib/protocol";
import type { Phase, PlannedQuestion } from "@/lib/types";
import { callNo, roman } from "@/lib/format";
import { locateQuestion, locateQuestionByText, questionLabel } from "@/lib/questions";
import { PHASE_SHORT, PHASE_TITLE, type RoomData } from "./types";

export type DeskTab = "cv" | "browser" | "board";
export type DeskScreen = "idle" | "cv" | "browser" | "question";

export interface DeskState {
  phase: { phase: Phase; index: number; total: number; endsAt: number | null; receivedAt: number } | null;
  screen: DeskScreen;
  /** Bumps on every screen / board.add message so the desk re-selects its tab even if the value is unchanged. */
  focus: { seq: number; tab: DeskTab | null };
  question: { text: string; kind: "core" | "probe"; hintId: string | null; fallbackN: number } | null;
  askedInPhase: number;
  highlight: { id: string; quote: string; page?: number; note?: string } | null;
  browser: { liveViewUrl: string | null; url: string | null; title: string | null };
  boardAdds: { n: number; shapes: SimpleShape[] }[];
  ended: { reportUrl: string | null } | null;
}

export const initialDesk: DeskState = {
  phase: null,
  screen: "idle",
  focus: { seq: 0, tab: null },
  question: null,
  askedInPhase: 0,
  highlight: null,
  browser: { liveViewUrl: null, url: null, title: null },
  boardAdds: [],
  ended: null,
};

export type DeskAction = { msg: DeskMsg; at: number };

export function deskReducer(s: DeskState, { msg, at }: DeskAction): DeskState {
  switch (msg.type) {
    case "phase":
      return { ...s, phase: { phase: msg.phase, index: msg.index, total: msg.total, endsAt: msg.endsAt, receivedAt: at }, askedInPhase: s.phase?.index === msg.index ? s.askedInPhase : 0 };
    case "screen":
      return { ...s, screen: msg.view, focus: { seq: s.focus.seq + 1, tab: msg.view === "cv" ? "cv" : msg.view === "browser" ? "browser" : null } };
    case "question":
      return { ...s, question: { text: msg.text, kind: msg.kind, hintId: s.highlight?.id ?? null, fallbackN: s.askedInPhase + 1 }, askedInPhase: s.askedInPhase + 1 };
    case "cv.highlight":
      return { ...s, highlight: { id: msg.id, quote: msg.quote, page: msg.page, note: msg.note } };
    case "cv.clear":
      return { ...s, highlight: null };
    case "browser.session":
      return { ...s, browser: { ...s.browser, liveViewUrl: msg.liveViewUrl } };
    case "browser.navigated":
      return { ...s, browser: { ...s.browser, url: msg.url, title: msg.title } };
    case "board.add":
      return { ...s, boardAdds: [...s.boardAdds, { n: s.boardAdds.length + 1, shapes: msg.shapes }], focus: { seq: s.focus.seq + 1, tab: "board" } };
    case "ended":
      return { ...s, ended: { reportUrl: msg.reportUrl } };
    default:
      return s;
  }
}

/** Parses an untrusted desk payload; returns null for anything that is not a known, well-formed message. */
export function parseDeskMsg(raw: string): DeskMsg | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  const str = (x: unknown): x is string => typeof x === "string";
  switch (m.type) {
    case "phase":
      return str(m.phase) && typeof m.index === "number" && typeof m.total === "number" ? (m as unknown as DeskMsg) : null;
    case "screen":
      return m.view === "idle" || m.view === "cv" || m.view === "browser" || m.view === "question" ? (m as unknown as DeskMsg) : null;
    case "question":
      return str(m.text) ? ({ type: "question", text: m.text, kind: m.kind === "probe" ? "probe" : "core" } as DeskMsg) : null;
    case "cv.highlight":
      return str(m.quote) && str(m.id) ? (m as unknown as DeskMsg) : null;
    case "cv.clear":
    case "ended":
      return m as unknown as DeskMsg;
    case "browser.session":
      return { type: "browser.session", liveViewUrl: str(m.liveViewUrl) ? m.liveViewUrl : null };
    case "browser.navigated":
      return str(m.url) ? { type: "browser.navigated", url: m.url, title: str(m.title) ? m.title : "" } : null;
    case "board.add":
      return Array.isArray(m.shapes) ? ({ type: "board.add", shapes: m.shapes as SimpleShape[] }) : null;
    default:
      return null;
  }
}

export interface ResolvedQuestion {
  tag: string;            // "Q2.3"
  spaced: string;         // "Q 2.3"
  planned: PlannedQuestion | null;
  phaseTitle: string;     // "Behavioral"
  phaseShort: string;     // "BEHAVIORAL"
  criterion: string | null;
}

/** Finds the planned question behind the question on screen (by text, then by the id of the CV highlight sent just before it). */
export function resolveQuestion(data: RoomData, desk: DeskState): ResolvedQuestion | null {
  const q = desk.question;
  if (!q) return null;
  const phases = data.plan.phases;
  const phaseIdx = desk.phase ? Math.min(desk.phase.index, phases.length - 1) : -1;
  const found = locateQuestionByText(data.plan, q.text, phaseIdx) ?? (q.hintId ? locateQuestion(data.plan, q.hintId) : null);
  const pi = found?.phaseIndex ?? Math.max(phaseIdx, 0);
  const n = found ? found.questionIndex + 1 : q.fallbackN;
  const planned = found?.question ?? null;
  const phase = phases[pi]?.phase ?? desk.phase?.phase ?? "behavioral";
  const id = planned?.competencyId ?? planned?.skillId ?? null;
  return {
    tag: found ? questionLabel(data.plan, found.question.id) ?? callNo.question(pi + 1, n) : callNo.question(pi + 1, n),
    spaced: `Q ${pi + 1}.${n}`,
    planned,
    phaseTitle: PHASE_TITLE[phase],
    phaseShort: PHASE_SHORT[phase],
    criterion: id ? data.criterionNames[id] ?? null : null,
  };
}

/**
 * Tag for the slip marker. One resolved tag per moment: the planned question on screen decides it, so the slip, the
 * question card, the outline row and (later) the report citation always agree. Only when the question on screen is
 * not in the plan does the planned question named by the highlight id decide.
 */
export function tagForHighlight(data: RoomData, desk: DeskState): string | null {
  const resolved = resolveQuestion(data, desk);
  if (resolved?.planned) return resolved.tag;
  const h = desk.highlight;
  if (h) {
    const label = questionLabel(data.plan, h.id);
    if (label) return label;
  }
  return resolveQuestion(data, desk)?.tag ?? null;
}

export function phaseHeading(data: RoomData, desk: DeskState): { numeral: string; short: string } | null {
  if (!desk.phase) return null;
  const idx = Math.min(desk.phase.index, Math.max(data.plan.phases.length - 1, 0));
  const phase = data.plan.phases[idx]?.phase ?? desk.phase.phase;
  return { numeral: roman(desk.phase.index + 1), short: PHASE_SHORT[phase] };
}

/** Elapsed / total seconds of the running phase, or null when the agent gave no deadline. */
export function phaseClock(data: RoomData, desk: DeskState, now: number): { elapsed: number; total: number } | null {
  const p = desk.phase;
  if (!p || p.endsAt == null) return null;
  const planned = data.plan.phases.find((x) => x.phase === p.phase)?.minutes;
  const remaining = Math.max(0, (p.endsAt - now) / 1000);
  const total = planned ? planned * 60 : Math.max(remaining, (p.endsAt - p.receivedAt) / 1000);
  return { elapsed: Math.min(total, Math.max(0, total - remaining)), total };
}

export function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}
