"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, RoomEvent, type Room } from "livekit-client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import type { ControlMsg } from "@/lib/protocol";
import { ErrorNote } from "@/components/ui";
import { useLiveBoardChannel } from "./board";
import { Desk } from "./Desk";
import { RoomHeader, RoomView } from "./RoomView";
import { useDeskChannel, useInterviewStart, useLatest, useLiveTranscript, useStoredFlag } from "./hooks";
import { useIntegrity, useRecorder } from "./session";
import type { EndReason } from "./Completion";
import type { AiState, RecordingView, RoomData } from "./types";
import type { WorksheetHandle } from "./Worksheet";

function sendControl(room: Room, msg: ControlMsg) {
  void room.localParticipant.sendText(JSON.stringify(msg), { topic: "control" }).catch(() => {});
}

function aiStateOf(s: string): AiState {
  if (s === "listening" || s === "thinking" || s === "speaking" || s === "idle" || s === "failed") return s;
  return "connecting";
}

function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active]);
}

interface Done {
  (reason: EndReason, recording?: RecordingView): void;
}

function CandidateRoom({ data, joinedAt, onDone }: { data: RoomData; joinedAt: number; onDone: Done }) {
  const room = useRoomContext();
  const desk = useDeskChannel(room);
  const channel = useLiveBoardChannel(room);
  const { state } = useVoiceAssistant();
  const connection = useConnectionState();
  const startedAt = useInterviewStart(data.interviewId, true);
  const lines = useLiveTranscript(room, startedAt, joinedAt);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const recorder = useRecorder(room, true, data.interviewId);
  const startRef = useLatest(startedAt ?? joinedAt);
  const integrity = useIntegrity(data.interviewId, () => (Date.now() - startRef.current) / 1000, true);
  const worksheet = useRef<WorksheetHandle>(null);
  const [captions, setCaptions] = useStoredFlag("kimma.captions", true);
  const [humanRequested, setHumanRequested] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deviceFail, setDeviceFail] = useState<string | null>(null);
  const closing = useRef(false);
  useBeforeUnload(!leaving);

  const wrapUp = useCallback(
    async (reason: EndReason) => {
      if (closing.current) return;
      closing.current = true;
      setLeaving(true);
      try {
        await worksheet.current?.flush();
      } catch {
        /* the board was already uploaded throttled while it changed */
      }
      const rec = await recorder.finish().catch((): RecordingView => ({ state: "failed", message: "The recording did not upload." }));
      room.disconnect();
      onDone(reason, rec);
    },
    [recorder, room, onDone],
  );

  useEffect(() => {
    if (desk.ended) void wrapUp("ended");
  }, [desk.ended, wrapUp]);

  useEffect(() => {
    const dropped = () => void wrapUp("dropped");
    const rejoined = () => integrity.post("rejoin");
    const media = (e: unknown) => setDeviceFail(String(e ?? "The microphone stopped."));
    room.on(RoomEvent.Disconnected, dropped);
    room.on(RoomEvent.Reconnected, rejoined);
    room.on(RoomEvent.MediaDevicesError, media);
    return () => {
      room.off(RoomEvent.Disconnected, dropped);
      room.off(RoomEvent.Reconnected, rejoined);
      room.off(RoomEvent.MediaDevicesError, media);
    };
  }, [room, wrapUp, integrity]);

  return (
    <RoomView
      data={data}
      desk={desk}
      aiState={aiStateOf(state)}
      transcript={lines}
      recording={recorder.view}
      channel={channel}
      micEnabled={isMicrophoneEnabled}
      onToggleMic={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => setDeviceFail("The microphone could not be switched."))}
      onFinished={() => sendControl(room, { type: "finished_answering" })}
      onRequestHuman={() => {
        sendControl(room, { type: "request_human" });
        setHumanRequested(true);
      }}
      onLeave={() => void wrapUp("left")}
      humanRequested={humanRequested}
      leaving={leaving}
      captions={captions}
      onToggleCaptions={() => setCaptions(!captions)}
      applyAdds
      uploadFor={data.interviewId}
      onPaste={integrity.paste}
      worksheetRef={worksheet}
      headerExtra={
        connection === ConnectionState.Reconnecting || connection === ConnectionState.SignalReconnecting ? (
          <span role="status" className="inline-flex items-center rounded-[3px] border border-dashed border-rule-strong px-2.5 py-1 font-mono text-[13px] text-chrome-link">
            RECONNECTING
          </span>
        ) : null
      }
      notice={
        <>
          <StartAudio label="Turn on Kimma's voice" className="min-h-12 w-fit cursor-pointer rounded-md border border-ink bg-ink px-5 text-[15px] font-semibold text-white" />
          {deviceFail ? (
            <ErrorNote title="Your microphone has a problem">{deviceFail} Check the browser&apos;s microphone setting, then unmute with the button below.</ErrorNote>
          ) : null}
        </>
      }
    />
  );
}

/** Meet mode: the board-only participant. Worksheet and pad full screen, no microphone, no audio playback. */
function BoardRoom({ data, joinedAt }: { data: RoomData; joinedAt: number }) {
  const room = useRoomContext();
  const desk = useDeskChannel(room);
  const channel = useLiveBoardChannel(room);
  const startedAt = useInterviewStart(data.interviewId, true);
  const startRef = useLatest(startedAt ?? joinedAt);
  const integrity = useIntegrity(data.interviewId, () => (Date.now() - startRef.current) / 1000, true);
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <RoomHeader data={data} desk={desk} recording={{ state: "meeting" }} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <Desk data={data} desk={desk} tag={null} channel={channel} adds={desk.boardAdds} applyAdds uploadFor={data.interviewId} onPaste={integrity.paste} only="board" />
      </main>
      <footer className="border-t border-rule bg-card px-4 py-3 sm:px-7">
        <p className="m-0 font-mono text-[13px] text-muted">Shared worksheet for your Google Meet interview. Kimma is in the call, an AI interviewer that cannot make the decision.</p>
      </footer>
    </div>
  );
}

export function LiveSession({
  data,
  variant,
  token,
  url,
  joinedAt,
  onDone,
  onFail,
}: {
  data: RoomData;
  variant: "candidate" | "board";
  token: string;
  url: string;
  joinedAt: number;
  onDone: Done;
  onFail: (message: string) => void;
}) {
  const candidate = variant === "candidate";
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      video={false}
      audio={candidate ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false}
      className="contents"
      onError={(e) => onFail(e.message || "Could not connect to the call server.")}
    >
      {candidate ? <CandidateRoom data={data} joinedAt={joinedAt} onDone={onDone} /> : <BoardRoom data={data} joinedAt={joinedAt} />}
      {candidate ? <RoomAudioRenderer /> : null}
    </LiveKitRoom>
  );
}
