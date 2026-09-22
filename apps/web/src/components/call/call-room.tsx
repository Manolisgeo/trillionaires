"use client";

import { useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { CallStage } from "@/components/call/call-stage";

export function CallRoom({ conversationId, title }: { conversationId: string; title: string }) {
  const [joined, setJoined] = useState(false);
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);
  const [token, setToken] = useState<string>();
  const [serverUrl, setServerUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (joined) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setError("Camera or microphone permission is required to join.");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [joined]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = audio;
    });
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = video;
    });
  }, [audio, video]);

  async function join() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setToken(data.participantToken);
      setServerUrl(data.serverUrl);
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  if (!joined || !token || !serverUrl) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0c0c0b] text-white">
        <header className="border-b border-white/10 px-6 py-5">
          <div className="text-xs text-white/45">Ready to join</div>
          <h1 className="mt-1 text-lg font-medium">{title}</h1>
        </header>
        <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl bg-white/5">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
          </div>
          <div>
            <p className="text-sm leading-6 text-white/65">
              An AI participant will join this room. The conversation is recorded. Captions, events,
              and a structured report are stored in your organization. The AI is labeled as AI — it
              does not impersonate a person.
            </p>
            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            <div className="mt-6 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setAudio((v) => !v)}
              >
                {audio ? <Mic size={18} /> : <MicOff size={18} />}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={() => setVideo((v) => !v)}
              >
                {video ? <Video size={18} /> : <VideoOff size={18} />}
              </Button>
              <Button type="button" onClick={join} disabled={loading}>
                {loading ? "Joining…" : "Join conversation"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio={audio}
      video={video}
      className="min-h-screen bg-[#0c0c0b] text-white"
    >
      <RoomAudioRenderer />
      <CallStage conversationId={conversationId} title={title} />
    </LiveKitRoom>
  );
}
