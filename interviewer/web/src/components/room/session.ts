"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent, Track, type Room } from "livekit-client";
import { api } from "@/lib/client";
import type { IntegritySignal } from "@/lib/types";
import type { RecordingView } from "./types";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

function audioTracks(room: Room): MediaStreamTrack[] {
  const out: MediaStreamTrack[] = [];
  const mine = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
  if (mine) out.push(mine);
  for (const p of room.remoteParticipants.values()) {
    const t = p.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (t) out.push(t);
  }
  return out;
}

const SYNC_EVENTS = [
  RoomEvent.Connected,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.ParticipantConnected,
] as const;

/**
 * Records a WebAudio mix of the candidate's mic and the agent's voice, and uploads it on finish.
 * The recording start time goes up with the file so the server can compute offsetSec against interview.startedAt.
 */
export function useRecorder(room: Room, enabled: boolean, interviewId: string) {
  const [view, setView] = useState<RecordingView>({ state: enabled ? "starting" : "off" });
  const sources = useRef(new Map<string, MediaStreamAudioSourceNode>());
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef<number | null>(null);
  const finishing = useRef<Promise<RecordingView> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const mime = pickMime();
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!mime || !AC) {
      setView({ state: "unsupported" });
      return;
    }
    const context = new AC();
    const dest = context.createMediaStreamDestination();
    void context.resume().catch(() => {});

    const sync = () => {
      const live = audioTracks(room);
      const ids = new Set(live.map((t) => t.id));
      for (const [id, node] of sources.current) {
        if (!ids.has(id)) {
          node.disconnect();
          sources.current.delete(id);
        }
      }
      for (const t of live) {
        if (sources.current.has(t.id) || t.readyState === "ended") continue;
        const node = context.createMediaStreamSource(new MediaStream([t]));
        node.connect(dest);
        sources.current.set(t.id, node);
      }
      if (!rec.current && sources.current.size > 0) {
        try {
          const r = new MediaRecorder(dest.stream, { mimeType: mime });
          r.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.current.push(e.data);
          };
          r.start(5000);
          rec.current = r;
          startedAt.current = Date.now();
          setView({ state: "recording", startedAt: startedAt.current });
        } catch (e) {
          setView({ state: "failed", message: e instanceof Error ? e.message : "The recorder could not start." });
        }
      }
    };
    for (const e of SYNC_EVENTS) room.on(e as RoomEvent.Connected, sync);
    sync();
    const nodes = sources.current;
    return () => {
      for (const e of SYNC_EVENTS) room.off(e as RoomEvent.Connected, sync);
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      for (const n of nodes.values()) n.disconnect();
      nodes.clear();
      rec.current = null;
      void context.close().catch(() => {});
    };
  }, [room, enabled]);

  /** Stops recording and uploads. Safe to call more than once (leave button, then "ended"). */
  const finish = useCallback((): Promise<RecordingView> => {
    if (finishing.current) return finishing.current;
    finishing.current = (async (): Promise<RecordingView> => {
      const done = (v: RecordingView): RecordingView => {
        setView(v);
        return v;
      };
      const r = rec.current;
      if (!r) return { state: "off" };
      setView({ state: "saving" });
      if (r.state !== "inactive") {
        await new Promise<void>((resolve) => {
          r.onstop = () => resolve();
          r.stop();
        });
      }
      const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
      if (blob.size === 0 || startedAt.current == null) return done({ state: "failed", message: "No audio was captured." });
      try {
        await api.interviews.recording(interviewId, blob, { recordingStartedAt: String(startedAt.current) });
        return done({ state: "saved" });
      } catch (e) {
        return done({ state: "failed", message: e instanceof Error ? e.message : "The recording did not upload." });
      }
    })();
    return finishing.current;
  }, [interviewId]);

  return { view, finish };
}

/** Integrity metadata only (never a verdict): tab hidden, paste into the pad or board, rejoin. */
export function useIntegrity(interviewId: string, secondsSinceStart: () => number, enabled: boolean) {
  const clock = useRef(secondsSinceStart);
  clock.current = secondsSinceStart;
  const post = useCallback(
    (kind: IntegritySignal["kind"], detail?: string) => {
      if (!enabled) return;
      const signal: IntegritySignal = { t: Math.max(0, clock.current()), kind, ...(detail ? { detail } : {}) };
      void api.interviews.integrity(interviewId, signal).catch(() => {});
    },
    [interviewId, enabled],
  );
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") post("tab_hidden");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, post]);
  const paste = useCallback((where: "board" | "pad", chars: number) => post("paste", `${where}, ${chars} characters`), [post]);
  return { post, paste };
}
