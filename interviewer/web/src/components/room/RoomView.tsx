"use client";

import { useState, type ReactNode, type Ref } from "react";
import { RecordingStamp } from "@/components/ui";
import { mmss } from "@/lib/format";
import type { BoardChannel } from "./board";
import { Desk } from "./Desk";
import type { CvMatchInfo } from "./CvViewer";
import { phaseClock, phaseHeading, resolveQuestion, tagForHighlight, hostOf, type DeskState } from "./deskState";
import { useNow } from "./hooks";
import { QuestionCard } from "./QuestionCard";
import { RoomFooter } from "./Footer";
import { AiPresence, Outline, Transcript } from "./Side";
import type { AiState, RecordingView, RoomData, TranscriptLine } from "./types";
import type { WorksheetHandle } from "./Worksheet";

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-[3px] border border-dashed border-rule-strong px-2.5 py-1 font-mono text-[13px] tracking-[0.06em] text-chrome-link">
      {children}
    </span>
  );
}

function RecordingReadout({ recording }: { recording: RecordingView }) {
  const now = useNow(1000);
  switch (recording.state) {
    case "recording":
      return <RecordingStamp clock={mmss((now - recording.startedAt) / 1000)} />;
    case "meeting":
      return <RecordingStamp />;
    case "starting":
      return <Chip>NOT RECORDING YET</Chip>;
    case "saving":
      return <Chip>SAVING RECORDING</Chip>;
    case "saved":
      return <Chip>RECORDING SAVED</Chip>;
    case "unsupported":
      return <Chip title="This browser cannot record audio.">NOT RECORDED</Chip>;
    case "failed":
      return <Chip title={recording.message}>RECORDING NOT SAVED</Chip>;
    case "preview":
      // The preview disclosure lives in one place (the banner / footer note); the header only says nothing is recorded.
      return <Chip>NOTHING RECORDED</Chip>;
    default:
      return null;
  }
}

export function RoomHeader({ data, desk, recording, extra }: { data: RoomData; desk: DeskState; recording: RecordingView; extra?: ReactNode }) {
  const now = useNow(1000);
  const heading = phaseHeading(data, desk);
  const clock = phaseClock(data, desk, now);
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-0 bg-hollinger px-4 text-white sm:px-7">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-0 py-2 sm:flex-1 sm:basis-80">
        <span className="text-sm font-bold tracking-[0.14em]">APERTURE</span>
        <span className="font-mono text-sm text-rule-strong">
          {data.callNo} · {data.role.title} · {data.role.company}
        </span>
      </div>
      <div role="timer" aria-label="Interview phase" className="font-mono text-sm tracking-[0.04em] text-white">
        {heading ? (
          <>
            {heading.numeral} · {heading.short}
            {clock ? <span className="ml-3">{mmss(clock.elapsed)} / {mmss(clock.total)}</span> : null}
          </>
        ) : (
          <span className="text-chrome-link">WAITING FOR APERTURE</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2.5 py-1.5 sm:flex-1 sm:basis-80">
        {extra}
        <RecordingReadout recording={recording} />
      </div>
    </header>
  );
}

function sourceLine(data: RoomData, desk: DeskState, cv: CvMatchInfo | null): string | null {
  const resolved = resolveQuestion(data, desk);
  const src = resolved?.planned?.source;
  if (src) {
    if (src.kind === "cv" || src.kind === "linkedin") {
      const page = cv?.page ?? src.page;
      return `Source: your ${src.kind === "cv" ? "CV" : "LinkedIn export"}${page ? `, page ${page}` : ""}${cv?.line ? `, line ${cv.line}` : ""}`;
    }
    if (src.url) return `Source: ${hostOf(src.url)}`;
    return `Source: your ${src.kind}`;
  }
  if (desk.highlight && cv?.found) return `Source: your CV, page ${cv.page}${cv.line ? `, line ${cv.line}` : ""}`;
  return null;
}

export interface RoomViewProps {
  data: RoomData;
  desk: DeskState;
  aiState: AiState;
  transcript: TranscriptLine[];
  recording: RecordingView;
  channel: BoardChannel | null;
  micEnabled: boolean;
  onToggleMic: () => void;
  onFinished: () => void;
  onRequestHuman: () => void;
  onLeave: () => void;
  humanRequested: boolean;
  leaving: boolean;
  captions: boolean;
  onToggleCaptions: () => void;
  applyAdds: boolean;
  uploadFor: string | null;
  onPaste?: (where: "board" | "pad", chars: number) => void;
  worksheetRef?: Ref<WorksheetHandle>;
  headerExtra?: ReactNode;
  footerNote?: ReactNode;
  /** Slot above the question card (audio-start prompt, device errors). */
  notice?: ReactNode;
  /** Thin bar under the header (preview label). */
  banner?: ReactNode;
  autoPickCv?: boolean;
}

/** The interview room, purely presentational: the same view serves the live call and the offline preview. */
export function RoomView(p: RoomViewProps) {
  const now = useNow(1000);
  const [cvMatch, setCvMatch] = useState<CvMatchInfo | null>(null);
  const resolved = resolveQuestion(p.data, p.desk);
  const last = p.transcript[p.transcript.length - 1];

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <RoomHeader data={p.data} desk={p.desk} recording={p.recording} extra={p.headerExtra} />
      {p.banner}
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <section aria-label="The desk" className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-5 pb-4 sm:px-8 sm:pt-6 sm:pb-5 lg:min-h-0">
          {p.notice}
          <QuestionCard text={p.desk.question?.text ?? null} kind={p.desk.question?.kind ?? null} resolved={resolved} source={sourceLine(p.data, p.desk, cvMatch)} />
          <Desk
            data={p.data}
            desk={p.desk}
            tag={tagForHighlight(p.data, p.desk)}
            channel={p.channel}
            adds={p.desk.boardAdds}
            applyAdds={p.applyAdds}
            uploadFor={p.uploadFor}
            onPaste={p.onPaste}
            onCvMatch={setCvMatch}
            worksheetRef={p.worksheetRef}
            autoPick={p.autoPickCv}
            below={
              p.captions ? (
                <div aria-hidden="true" className="mt-3 flex min-h-12 items-center gap-3 border border-rule bg-card px-4 py-2 text-base leading-6">
                  <span className="shrink-0 font-mono text-xs tracking-[0.12em] text-muted">CAPTIONS</span>
                  {last ? (
                    <span className="line-clamp-2 min-w-0">
                      <b className={last.who === "agent" ? "text-stamp" : ""}>{last.who === "agent" ? "APERTURE" : "YOU"}</b> {last.text}
                    </span>
                  ) : (
                    <span className="text-muted">Words appear here as they are spoken.</span>
                  )}
                </div>
              ) : null
            }
          />
        </section>
        <aside aria-label="Interview status" className="flex shrink-0 flex-col border-t border-rule bg-card lg:w-[380px] lg:overflow-y-auto lg:border-t-0 lg:border-l xl:w-[420px]">
          <AiPresence state={p.aiState} />
          <Outline data={p.data} desk={p.desk} now={now} />
          <Transcript lines={p.transcript} />
        </aside>
      </main>
      <RoomFooter
        micEnabled={p.micEnabled}
        onToggleMic={p.onToggleMic}
        onFinished={p.onFinished}
        onRequestHuman={p.onRequestHuman}
        onLeave={p.onLeave}
        captions={p.captions}
        onToggleCaptions={p.onToggleCaptions}
        humanRequested={p.humanRequested}
        leaving={p.leaving}
        note={p.footerNote}
      />
    </div>
  );
}
