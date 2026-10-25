"use client";

import { useCallback, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { Completion, type EndReason } from "./Completion";
import { LiveSession } from "./Live";
import { Lobby } from "./Lobby";
import { RoomPreview, type PreviewScene } from "./Preview";
import type { RecordingView, RoomData } from "./types";

export type RoomMode = "live" | "board" | "preview";

/** /room/[id]: lobby, then the live room (or board-only view, or the offline preview). */
export default function RoomEntry({ data, mode, scene, boardOnly }: { data: RoomData; mode: RoomMode; scene?: PreviewScene; boardOnly?: boolean }) {
  const [conn, setConn] = useState<{ token: string; url: string; joinedAt: number } | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [done, setDone] = useState<{ reason: EndReason; recording?: RecordingView } | null>(
    data.status === "done" || data.status === "processing" ? { reason: "closed" } : null,
  );

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const t = await api.interviews.token(data.interviewId, mode === "board" ? "board" : "candidate");
      setConn({ token: t.token, url: t.url, joinedAt: Date.now() });
    } catch (e) {
      setError(e instanceof ApiError ? { status: e.status, message: e.message } : { status: 0, message: "Could not join. Try again." });
    } finally {
      setJoining(false);
    }
  }, [data.interviewId, mode]);

  const onDone = useCallback((reason: EndReason, recording?: RecordingView) => {
    setConn(null);
    setDone({ reason, recording });
  }, []);
  const onFail = useCallback((message: string) => {
    setConn(null);
    setError({ status: 502, message });
  }, []);

  if (mode === "preview") return <RoomPreview data={data} scene={scene} boardOnly={boardOnly} />;
  if (done) return <Completion data={data} reason={done.reason} recording={done.recording} onRejoin={mode === "live" || mode === "board" ? () => setDone(null) : undefined} />;
  if (conn) {
    return <LiveSession data={data} variant={mode === "board" ? "board" : "candidate"} token={conn.token} url={conn.url} joinedAt={conn.joinedAt} onDone={onDone} onFail={onFail} />;
  }
  return (
    <Lobby
      data={data}
      variant={mode === "board" ? "board" : "candidate"}
      onJoin={() => void join()}
      joining={joining}
      error={error}
      previewHref={`/room/${data.interviewId}?preview=1`}
    />
  );
}
