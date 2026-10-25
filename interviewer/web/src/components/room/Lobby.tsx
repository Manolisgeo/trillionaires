"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic } from "lucide-react";
import { Button, ButtonLink, CatalogCard, ErrorNote } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { RoomData } from "./types";

type MicState = "idle" | "asking" | "ok" | "denied" | "none" | "error";
const SEGMENTS = 24;

/** Mic check: a real getUserMedia stream measured through an analyser; the stream is released before the call starts. */
function useMicCheck() {
  const [state, setState] = useState<MicState>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const [device, setDevice] = useState("");
  const cleanup = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    setState("asking");
    setHeard(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const track = stream.getAudioTracks()[0];
      setDevice(track?.label ?? "");
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let raf = 0;
      let last = 0;
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        if (t - last < 60) return;
        last = t;
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const lv = Math.min(1, Math.sqrt(sum / buf.length) * 5);
        setLevel(lv);
        if (lv > 0.15) setHeard(true);
      };
      raf = requestAnimationFrame(tick);
      cleanup.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((x) => x.stop());
        void ctx.close().catch(() => {});
        setLevel(0);
      };
      setState("ok");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "none" : "error");
    }
  }, [stop]);

  return { state, level, heard, device, start, stop };
}

export function Lobby({
  data,
  variant,
  onJoin,
  joining,
  error,
  previewHref,
}: {
  data: RoomData;
  variant: "candidate" | "board";
  onJoin: () => void;
  joining: boolean;
  error: { status: number; message: string } | null;
  previewHref: string;
}) {
  const mic = useMicCheck();
  const minutes = Math.round(data.plan.phases.reduce((n, p) => n + p.minutes, 0));
  const parts = data.plan.phases.length;
  const board = variant === "board";
  const ready = board || mic.state === "ok";
  const active = Math.round(mic.level * SEGMENTS);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-x-3.5 bg-hollinger px-4 py-2 text-white sm:px-7">
        <span className="text-sm font-bold tracking-[0.14em]">APERTURE</span>
        <span className="font-mono text-sm text-rule-strong">
          {data.callNo} · {data.role.title} · {data.role.company}
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">
        <h1 className="m-0 max-w-[24ch] text-[28px] leading-9 font-bold text-balance">
          {board ? "The shared worksheet" : `Before you join, ${data.candidate.firstName}`}
        </h1>

        <div className={`grid items-start gap-6 ${board ? "" : "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"}`}>
          <CatalogCard callNo={data.callNo} kicker="HOW THIS INTERVIEW WORKS" right="READ BEFORE JOINING" aria-label="How this interview works">
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] leading-6">
              {board
                ? [
                    "Aperture is in your Google Meet call. This page is only the shared worksheet.",
                    "When Aperture asks you to draw or write, do it here. It can see the board and the pad, and it draws in violet.",
                    "The meeting is recorded and transcribed. A person at the company reads the report and decides.",
                  ].map((t) => <li key={t}>{t}</li>)
                : [
                    "You are talking to Aperture, an AI interviewer. It is not a person and it cannot make the decision.",
                    `The call is recorded and transcribed. A person at ${data.role.company} reads the report and decides.`,
                    "Every question appears on screen as it is asked, with the line of your CV or the page it comes from.",
                    "Say you are finished, or press the button, when you are done. Take your time to think; Aperture waits.",
                    "You can ask for a human interviewer at any moment.",
                  ].map((t) => <li key={t}>{t}</li>)}
              <li className="font-mono text-[13px] text-muted">
                {board ? "" : `About ${minutes} minutes in ${parts} parts. `}You agreed to this on {formatDate(data.candidate.consentAt)}.
              </li>
            </ul>
          </CatalogCard>

          {board ? null : (
            <CatalogCard dashed kicker="MICROPHONE CHECK" right={mic.state === "ok" ? "READY" : "NOT CHECKED"} aria-label="Microphone check">
              <p className="m-0 text-[15px] leading-6 text-ink-2">Aperture listens to you through your microphone. Check it now, then say a sentence out loud.</p>
              <div
                role="meter"
                aria-label="Microphone level"
                aria-valuemin={0}
                aria-valuemax={SEGMENTS}
                aria-valuenow={active}
                className="flex h-8 items-end gap-[3px]"
              >
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span key={i} className={`w-full ${i < active ? "bg-stamp" : "bg-rule"}`} style={{ height: `${40 + (i / SEGMENTS) * 60}%` }} />
                ))}
              </div>
              <p role="status" className="m-0 min-h-6 font-mono text-[13px] text-ink-2">
                {mic.state === "ok"
                  ? mic.heard
                    ? "We can hear you."
                    : `Listening${mic.device ? ` on ${mic.device}` : ""}. Say a sentence.`
                  : mic.state === "asking"
                    ? "Waiting for your browser's permission prompt."
                    : ""}
              </p>
              {mic.state === "denied" ? (
                <ErrorNote title="Microphone is blocked">Allow the microphone for this site in the address bar, then press Check microphone again.</ErrorNote>
              ) : mic.state === "none" ? (
                <ErrorNote title="No microphone found">Plug in or enable a microphone, then press Check microphone again.</ErrorNote>
              ) : mic.state === "error" ? (
                <ErrorNote title="The microphone could not start">Close other apps that use it, then press Check microphone again.</ErrorNote>
              ) : null}
              <div>
                <Button variant="secondary" size={48} onClick={() => void mic.start()} busy={mic.state === "asking"}>
                  {mic.state === "ok" ? <Check size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                  {mic.state === "ok" ? "Check again" : "Check microphone"}
                </Button>
              </div>
            </CatalogCard>
          )}
        </div>

        {error ? (
          <ErrorNote
            title={error.status === 503 ? "Live voice is not set up on this server" : error.status === 409 ? "This interview has already ended" : "Could not join"}
            action={
              error.status === 503 ? (
                <a href={previewHref} className="inline-flex min-h-11 items-center font-semibold">
                  Open the room preview instead
                </a>
              ) : undefined
            }
          >
            {error.status === 503
              ? "The call needs LiveKit keys. You can still see the whole room with scripted content, without voice."
              : error.message}
          </ErrorNote>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <Button
            size={48}
            busy={joining}
            disabled={!ready}
            aria-describedby="join-hint"
            onClick={() => {
              mic.stop();
              onJoin();
            }}
          >
            {board ? "Open the worksheet" : "Join the interview"}
          </Button>
          <span id="join-hint" className="font-mono text-[13px] text-muted">
            {ready ? (board ? "No microphone is used on this page." : "Your microphone check is done.") : "Check your microphone first."}
          </span>
          <span className="flex-1" />
          <ButtonLink href={previewHref} variant="secondary" size={44}>
            Preview the room, no voice
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
