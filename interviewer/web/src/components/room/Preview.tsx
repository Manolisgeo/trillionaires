"use client";

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import { deskReducer, initialDesk } from "./deskState";
import { Completion } from "./Completion";
import { Desk } from "./Desk";
import { RoomHeader, RoomView } from "./RoomView";
import type { AiState, RoomData, TranscriptLine } from "./types";

/**
 * Offline preview: no LiveKit. Real interview data (CV, plan, role) with a short scripted run, driven through the
 * same reducer and the same view as the live call. Labelled as a preview everywhere it could be mistaken for a call.
 */
export type PreviewScene = "cv" | "browser" | "board";

export function RoomPreview({ data, scene = "cv", boardOnly = false }: { data: RoomData; scene?: PreviewScene; boardOnly?: boolean }) {
  const [run, setRun] = useState(0);
  const [left, setLeft] = useState(false);
  if (boardOnly) return <PreviewBoardOnly data={data} />;
  if (left) {
    return <Completion data={data} reason="left" onRejoin={() => { setLeft(false); setRun((n) => n + 1); }} />;
  }
  return <PreviewRun key={run} data={data} scene={scene} onLeave={() => setLeft(true)} />;
}

/** The scripted run: the same desk messages the agent would send, folded by the real reducer. */
export function usePreviewScript(data: RoomData, scene: PreviewScene) {
  const [desk, dispatch] = useReducer(deskReducer, initialDesk);
  const [ai, setAi] = useState<AiState>("speaking");
  const [lines, setLines] = useState<TranscriptLine[]>([]);

  useEffect(() => {
    const phases = data.plan.phases;
    const all = phases.flatMap((p) => p.questions);
    const bi = Math.max(0, phases.findIndex((p) => p.phase === "behavioral"));
    const core = phases[bi]?.questions.find((q) => q.kind === "core") ?? all[0];
    const probe = all.find((q) => q.kind === "probe" && q.source?.kind === "cv" && q.source.quote) ?? all.find((q) => q.source?.quote);
    // One coherent moment on the first screen: the phase, the question card, the CV highlight and the slip all describe
    // the same planned question, so the call tag reads identically everywhere.
    const asked = probe ?? core;
    const pi = asked ? Math.max(0, phases.findIndex((p) => p.questions.some((q) => q.id === asked.id))) : bi;
    const pp = phases[pi];
    const askedText = asked?.text ?? "Tell me about a time you took ownership of a problem nobody had asked you to solve.";
    const quote = probe?.source?.quote ?? "";
    const total = (pp?.minutes ?? 10) * 60;
    const elapsedAtStart = total * 0.67;
    const t0 = Date.now();
    const at = (n: number) => 792 + n; // timecodes start at 13:12, like the approved comp
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const say = (id: string, who: TranscriptLine["who"], text: string, sec: number, final = true) =>
      setLines((l) => [...l.filter((x) => x.id !== id), { id, who, text, at: at(sec), final }]);

    dispatch({ msg: { type: "phase", phase: pp?.phase ?? "behavioral", index: pi, total: phases.length, endsAt: t0 + (total - elapsedAtStart) * 1000 }, at: t0 });
    dispatch({ msg: { type: "screen", view: "cv" }, at: t0 });
    if (probe) dispatch({ msg: { type: "cv.highlight", id: probe.id, quote, page: probe.source?.page ?? 1, note: "Preview highlight" }, at: t0 });
    dispatch({ msg: { type: "question", text: askedText, kind: asked?.kind ?? "core" }, at: t0 });
    say("p1", "agent", askedText, 0);
    say("p2", "candidate", "[Preview line] Your spoken answers appear here as you say them, in the same type as Kimma's.", 8);
    if (data.github || data.firstLink) {
      const url = data.github?.url ?? data.firstLink ?? "";
      dispatch({ msg: { type: "browser.session", liveViewUrl: null }, at: t0 });
      dispatch({ msg: { type: "browser.navigated", url, title: data.github ? `${data.github.handle} on GitHub` : "Candidate link" }, at: t0 });
    }
    later(6000, () => {
      setAi("listening");
      say("p4", "candidate", "[Preview line] The decision was mine…", 30, false);
    });
    if (scene === "browser") later(4200, () => dispatch({ msg: { type: "screen", view: "browser" }, at: Date.now() }));
    if (scene === "board") {
      later(4200, () =>
        dispatch({
          msg: {
            type: "board.add",
            shapes: [
              { kind: "rect", x: 80, y: 80, w: 190, h: 80, label: "Client" },
              { kind: "rect", x: 420, y: 80, w: 190, h: 80, label: "Billing API" },
              { kind: "ellipse", x: 420, y: 260, w: 190, h: 90, label: "Event store" },
              { kind: "arrow", x: 270, y: 120, toX: 420, toY: 120, label: "POST /invoices" },
              { kind: "arrow", x: 515, y: 160, toX: 515, toY: 260 },
              { kind: "text", x: 80, y: 300, label: "Draw how an invoice becomes an event." },
            ],
          },
          at: Date.now(),
        }),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [data, scene]);

  return { desk, ai, setAi, lines };
}

/** Meet mode's board-only participant, offline: worksheet and pad full screen under the same header. */
function PreviewBoardOnly({ data }: { data: RoomData }) {
  const { desk } = usePreviewScript(data, "board");
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <RoomHeader data={data} desk={desk} recording={{ state: "preview" }} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <Desk data={data} desk={desk} tag={null} channel={null} adds={desk.boardAdds} applyAdds uploadFor={null} only="board" />
      </main>
      <footer className="border-t border-rule bg-card px-4 py-3 sm:px-7">
        <p className="m-0 font-mono text-[13px] text-muted">Preview — no live voice. Shared worksheet for a Google Meet interview.</p>
      </footer>
    </div>
  );
}

function PreviewRun({ data, scene, onLeave }: { data: RoomData; scene: PreviewScene; onLeave: () => void }) {
  const { desk, ai, setAi, lines } = usePreviewScript(data, scene);
  const [mic, setMic] = useState(true);
  const [human, setHuman] = useState(false);
  const [captions, setCaptions] = useState(true);
  return (
    <RoomView
      data={data}
      desk={desk}
      aiState={ai}
      transcript={lines}
      recording={{ state: "preview" }}
      channel={null}
      micEnabled={mic}
      onToggleMic={() => setMic((m) => !m)}
      onFinished={() => setAi("thinking")}
      onRequestHuman={() => setHuman(true)}
      onLeave={onLeave}
      humanRequested={human}
      leaving={false}
      captions={captions}
      onToggleCaptions={() => setCaptions((c) => !c)}
      applyAdds
      uploadFor={null}
      autoPickCv
      banner={
        <p role="note" className="m-0 flex flex-wrap items-center gap-x-4 gap-y-0 bg-hollinger-2 px-4 py-0 font-mono text-[13px] text-chrome-link sm:px-7">
          <b className="tracking-[0.08em] text-white">PREVIEW — NO LIVE VOICE</b>
          <span className="hidden sm:inline">Real CV, plan and role from this interview; the question, highlight and transcript are scripted. Nothing is recorded.</span>
          <Link href={`/room/${data.interviewId}`} className="inline-flex min-h-11 items-center font-semibold text-white underline focus-visible:outline-white">
            Back to the lobby
          </Link>
        </p>
      }
    />
  );
}
