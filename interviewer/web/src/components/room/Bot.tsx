"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useVoiceAssistant } from "@livekit/components-react";
import { Cataloguing, ErrorNote } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { useLiveBoardChannel, type BoardChannel } from "./board";
import { usePreviewScript } from "./Preview";
import { BrowserView } from "./BrowserView";
import { RoomHeader } from "./RoomView";
import { hostOf, resolveQuestion, tagForHighlight, type DeskState } from "./deskState";
import { useDeskChannel, useNow } from "./hooks";
import { QuestionCard } from "./QuestionCard";
import { AiPresence, Outline } from "./Side";
import type { AiState, RoomData } from "./types";
import dynamic from "next/dynamic";

const CvViewer = dynamic(() => import("./CvViewer"), { ssr: false, loading: () => <Cataloguing label="Opening the CV" className="p-6" /> });
const Worksheet = dynamic(() => import("./Worksheet"), { ssr: false });

function BotView({ data, desk, ai, channel, preview }: { data: RoomData; desk: DeskState; ai: AiState; channel: BoardChannel | null; preview?: boolean }) {
  const now = useNow(1000);
  const resolved = resolveQuestion(data, desk);
  const showBrowser = desk.screen === "browser";
  const worksheetUrl = `${data.publicBaseUrl}/room/${data.interviewId}?view=board`;
  return (
    <div className="flex h-[720px] w-[1280px] flex-col overflow-hidden bg-board">
      <RoomHeader data={data} desk={desk} recording={preview ? { state: "preview" } : { state: "meeting" }} />
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <section aria-label="The desk" className="flex min-w-0 flex-1 flex-col gap-3">
          <QuestionCard text={desk.question?.text ?? null} kind={desk.question?.kind ?? null} resolved={resolved} source={null} />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex gap-1 pl-3" aria-hidden="true">
              <span className="relative top-px rounded-t-md border border-rule border-b-card bg-card px-4 py-2 text-sm font-semibold">
                {showBrowser ? (desk.browser.url ? hostOf(desk.browser.url) : "Browser") : `CV · ${data.cv?.label ?? "none on file"}`}
              </span>
            </div>
            <div className="relative min-h-0 flex-1 border border-rule bg-card">
              {showBrowser ? (
                <BrowserView browser={desk.browser} />
              ) : data.cv ? (
                <CvViewer url={data.cv.url} highlight={desk.highlight} tag={tagForHighlight(data, desk)} maxPageWidth={560} autoPick={preview} />
              ) : null}
            </div>
          </div>
        </section>
        <aside aria-label="Interview status" className="flex w-[400px] shrink-0 flex-col gap-3">
          <div className="border border-rule bg-card">
            <AiPresence state={ai} />
            <Outline data={data} desk={desk} now={now} />
          </div>
          <div className="border border-rule bg-card px-4 py-3">
            <p className="m-0 font-mono text-[13px] text-muted">Join the worksheet:</p>
            <p className="m-0 font-mono text-[15px] font-bold break-all text-ink">{worksheetUrl}</p>
          </div>
          <div className="relative min-h-0 flex-1 border border-rule bg-white" role="img" aria-label="Worksheet, read only">
            <Worksheet channel={channel} adds={desk.boardAdds} applyAdds={Boolean(preview)} readOnly />
            <span className="pointer-events-none absolute top-2 left-3 font-mono text-[12px] tracking-[0.12em] text-muted" aria-hidden="true">
              WORKSHEET · MIRROR
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BotRoom({ data }: { data: RoomData }) {
  const room = useRoomContext();
  const desk = useDeskChannel(room);
  const channel = useLiveBoardChannel(room);
  const { state } = useVoiceAssistant();
  const ai: AiState = state === "listening" || state === "thinking" || state === "speaking" || state === "idle" || state === "failed" ? state : "connecting";
  return <BotView data={data} desk={desk} ai={ai} channel={channel} />;
}

/** Offline stand-in for design review: the same bridge layout driven by the scripted preview, no LiveKit. */
function BotPreview({ data }: { data: RoomData }) {
  const { desk, ai } = usePreviewScript(data, "cv");
  return <BotView data={data} desk={desk} ai={ai} channel={null} preview />;
}

/** /bot/[id]: the page the Recall bot loads as its camera. Joins the room as a bridge: meeting audio in, agent voice out. */
export default function BotBridge({ data, preview = false }: { data: RoomData; preview?: boolean }) {
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    let timer = 0;
    const attempt = async () => {
      try {
        const t = await api.interviews.token(data.interviewId, "bridge");
        if (alive) {
          setConn({ token: t.token, url: t.url });
          setError(null);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Could not reach the server.");
        timer = window.setTimeout(attempt, 5000);
      }
    };
    void attempt();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [data.interviewId, preview]);

  if (preview) return <BotPreview data={data} />;
  if (!conn) {
    return (
      <div className="flex h-[720px] w-[1280px] flex-col items-center justify-center gap-4 overflow-hidden bg-board">
        {error ? <ErrorNote title="The bridge could not join the interview room">{error} Retrying every few seconds.</ErrorNote> : <Cataloguing label="Joining the interview room" />}
      </div>
    );
  }
  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      video={false}
      // Meeting audio, untouched: no echo cancellation, noise suppression or gain control on other people's voices.
      audio={{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }}
      className="contents"
      onError={(e) => setError(e.message)}
    >
      <BotRoom data={data} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
