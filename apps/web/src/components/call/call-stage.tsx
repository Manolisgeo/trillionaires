"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  useVoiceAssistant,
  VideoTrack,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import type { TranscriptionSegment } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { formatTimestamp } from "@/lib/time";

type Caption = {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  isFinal: boolean;
};

export function CallStage({ conversationId, title }: { conversationId: string; title: string }) {
  const router = useRouter();
  const room = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const assistant = useVoiceAssistant();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [query, setQuery] = useState("");
  const [ending, setEnding] = useState(false);
  const started = useRef(Date.now());
  const captionEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onTranscript = (
      segments: TranscriptionSegment[],
      participant?: { identity: string; name?: string },
    ) => {
      setCaptions((current) => {
        const next = [...current];
        for (const segment of segments) {
          const caption: Caption = {
            id: segment.id,
            speakerId: participant?.identity ?? "unknown",
            speakerName:
              participant?.name ??
              (participant?.identity === room.localParticipant.identity ? "You" : "Participant"),
            text: segment.text,
            startTime: segment.startTime ? segment.startTime / 1000 : elapsed,
            isFinal: Boolean(segment.final),
          };
          const index = next.findIndex((item) => item.id === segment.id);
          if (index >= 0) next[index] = caption;
          else next.push(caption);
        }
        return next.slice(-80);
      });
    };
    room.on(RoomEvent.TranscriptionReceived, onTranscript);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, onTranscript);
    };
  }, [room, elapsed]);

  useEffect(() => {
    captionEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions]);

  const visibleCaptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return captions;
    return captions.filter(
      (c) => c.text.toLowerCase().includes(q) || c.speakerName.toLowerCase().includes(q),
    );
  }, [captions, query]);

  async function endCall() {
    setEnding(true);
    try {
      await fetch(`/api/conversations/${conversationId}/end`, { method: "POST" });
      room.disconnect();
      router.push(`/conversations/${conversationId}`);
    } catch {
      setEnding(false);
    }
  }

  const agentSpeaking = assistant.state === "speaking";
  const localTrack = tracks.find((track) => track.participant.isLocal);

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
      <header className="col-span-full flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <div className="text-xs text-white/45">Live · AI participant in the room</div>
          <h1 className="truncate text-base font-medium">{title}</h1>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span className="inline-flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
            Recording
          </span>
          <span className="font-mono">{formatTimestamp(elapsed)}</span>
          <span>{connection === ConnectionState.Connected ? "Connected" : connection}</span>
        </div>
      </header>

      <section className="grid content-start gap-4 p-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl bg-white/5">
          {localTrack && (localTrack.publication?.isSubscribed || localTrack.participant.isLocal) ? (
            <VideoTrack trackRef={localTrack} className="aspect-video h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-white/40">Camera off</div>
          )}
          <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs">You</div>
        </div>
        <div className="relative flex aspect-video flex-col items-center justify-center rounded-2xl bg-white/[0.06]">
          <div
            className={`h-24 w-24 rounded-full border border-white/20 transition-transform ${
              agentSpeaking ? "scale-105 bg-emerald-400/25" : "bg-white/10"
            }`}
          />
          <div className="mt-4 text-sm">Aperture</div>
          <div className="text-xs text-white/50">AI · {assistant.state || "listening"}</div>
          <div className="mt-2 rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/55">
            AI-generated
          </div>
        </div>
        <p className="text-xs text-white/40 md:col-span-2">
          {participants
            .map((p) => {
              const agent = p.identity === "aperture-agent" || p.name === "Aperture";
              return `${p.name || p.identity}${agent ? " (AI)" : ""}${p.isSpeaking ? " · speaking" : ""}`;
            })
            .join("  ·  ")}
        </p>
      </section>

      <aside className="flex flex-col border-t border-white/10 bg-black/30 p-5 lg:row-span-2 lg:border-l lg:border-t-0">
        <h2 className="text-sm font-medium">Live transcript</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captions"
          className="mt-3 h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 outline-none"
        />
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {visibleCaptions.length === 0 ? (
            <p className="text-sm text-white/40">Captions will appear as people speak.</p>
          ) : (
            visibleCaptions.map((caption) => (
              <div key={caption.id} className={caption.isFinal ? "" : "caption-interim"}>
                <div className="text-[11px] uppercase tracking-wide text-white/40">
                  {caption.speakerName}
                </div>
                <p className="text-sm leading-relaxed">{caption.text}</p>
              </div>
            ))
          )}
          <div ref={captionEnd} />
        </div>
      </aside>

      <footer className="col-span-full flex items-center justify-center gap-3 border-t border-white/10 px-6 py-4 lg:col-span-1">
        <Button
          variant="secondary"
          size="icon"
          className="border-white/10 bg-white/10 text-white hover:bg-white/20"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="border-white/10 bg-white/10 text-white hover:bg-white/20"
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </Button>
        <Button variant="danger" onClick={endCall} disabled={ending}>
          <PhoneOff size={16} />
          {ending ? "Ending…" : "End"}
        </Button>
      </footer>
    </div>
  );
}
