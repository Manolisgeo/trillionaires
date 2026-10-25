"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useTranscriptions } from "@livekit/components-react";
import { api } from "@/lib/client";
import { deskReducer, initialDesk, parseDeskMsg, type DeskState } from "./deskState";
import type { TranscriptLine } from "./types";

/** Epoch ms that re-renders every `ms` (readouts tick; nothing else moves). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** localStorage-backed boolean that never throws (private windows, blocked storage). */
export function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "1" || raw === "0") setV(raw === "1");
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  return [
    v,
    (next: boolean) => {
      setV(next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
    },
  ];
}

const CLIENT_IDENTITY = /^(candidate|board|bridge)-/;

/** Subscribes to the agent's "desk" text stream and folds it into DeskState. */
export function useDeskChannel(room: Room): DeskState {
  const [state, dispatch] = useReducer(deskReducer, initialDesk);
  useEffect(() => {
    room.registerTextStreamHandler("desk", async (reader, info) => {
      if (CLIENT_IDENTITY.test(info.identity)) return; // only the agent drives the desk
      try {
        const msg = parseDeskMsg(await reader.readAll());
        if (msg) dispatch({ msg, at: Date.now() });
      } catch {
        /* a broken stream is dropped, the next message restores state */
      }
    });
    return () => room.unregisterTextStreamHandler("desk");
  }, [room]);
  return state;
}

/** Server-side interview start (set by the agent), so timecodes match the report. Falls back to null. */
export function useInterviewStart(interviewId: string, enabled: boolean): number | null {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const { interview } = await api.interviews.get(interviewId);
        if (!alive) return;
        if (interview.startedAt) {
          setStartedAt(Date.parse(interview.startedAt));
          return;
        }
      } catch {
        /* retry */
      }
      if (alive && tries < 40) timer = window.setTimeout(tick, 2500);
    };
    let timer = window.setTimeout(tick, 800);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [interviewId, enabled]);
  return startedAt;
}

/** Live captions from LiveKit transcription streams, as one ordered list. Must be used inside a room. */
export function useLiveTranscript(room: Room, startedAt: number | null, joinedAt: number): TranscriptLine[] {
  const streams = useTranscriptions();
  const localId = room.localParticipant.identity;
  return useMemo(() => {
    const base = startedAt ?? joinedAt;
    return streams
      .filter((s) => s.text.trim().length > 0)
      .map((s): TranscriptLine => {
        const attrs = s.streamInfo.attributes ?? {};
        return {
          id: attrs["lk.segment_id"] ?? s.streamInfo.id,
          who: s.participantInfo.identity === localId ? "candidate" : "agent",
          text: s.text.trim(),
          at: Math.max(0, (s.streamInfo.timestamp - base) / 1000),
          final: attrs["lk.transcription_final"] !== "false",
        };
      })
      .sort((a, b) => a.at - b.at);
  }, [streams, localId, startedAt, joinedAt]);
}

/** Elapsed whole seconds since `from` (epoch ms). */
export function useElapsed(from: number | null): number {
  const now = useNow(1000);
  return from == null ? 0 : Math.max(0, Math.floor((now - from) / 1000));
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
