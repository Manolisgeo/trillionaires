"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { mmss } from "@/lib/format";

export interface PlayerHandle {
  seekAndPlay: (interviewT: number) => void;
}

/** Audio element with Reading Room controls: round play, mono timecode, tick-rule scrubber, violet playhead. */
export const Player = forwardRef<PlayerHandle, { url: string; offsetSec: number; fallbackDuration: number }>(function Player(
  { url, offsetSec, fallbackDuration },
  ref,
) {
  const audio = useRef<HTMLAudioElement>(null);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const total = dur > 0 && Number.isFinite(dur) ? dur : fallbackDuration;

  useImperativeHandle(ref, () => ({
    seekAndPlay(t) {
      const a = audio.current;
      if (!a) return;
      a.currentTime = Math.max(0, t - offsetSec);
      void a.play().catch(() => setFailed(true));
    },
  }));

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true));
    else a.pause();
  }, []);

  useEffect(() => {
    const a = audio.current;
    if (a && a.readyState >= 1) setDur(a.duration);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-[0.12em] text-muted">RECORDING</span>
        <span className="font-mono text-[13px] tabular-nums" aria-live="off">
          {mmss(pos)} / {mmss(total)}
        </span>
      </div>
      <div className="relative h-10">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: "repeating-linear-gradient(to right, #A9B6BD 0, #A9B6BD 2px, transparent 2px, transparent 5px)" }}
        />
        <span
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 bg-stamp"
          style={{ left: `${total > 0 ? Math.min(100, (pos / total) * 100) : 0}%` }}
        />
        <input
          type="range"
          aria-label="Recording position"
          aria-valuetext={`${mmss(pos)} of ${mmss(total)}`}
          min={0}
          max={Math.max(1, Math.floor(total))}
          step={1}
          value={Math.min(Math.floor(pos), Math.max(1, Math.floor(total)))}
          onChange={(e) => {
            const a = audio.current;
            if (a) a.currentTime = Number(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause recording" : "Play recording"}
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-ink text-white hover:bg-ink-2"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 2l9 5-9 5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span className="text-[13px] text-muted">{failed ? "The recording could not be played in this browser." : "Every quote jumps here."}</span>
      </div>
    </div>
  );
});
