import type { Phase, Plan } from "@/lib/types";

/** Serializable snapshot of an interview that the room needs (built on the server in app/room/_data.ts). */
export interface RoomData {
  interviewId: string;
  callNo: string;
  status: "scheduled" | "live" | "processing" | "done" | "failed";
  mode: "room" | "meet";
  role: { title: string; company: string };
  candidate: { name: string; firstName: string; consentAt: string };
  demo: boolean;
  cv: { url: string; label: string } | null;
  plan: Plan;
  /** competency + skill id -> display name, for kickers and the finding aid. */
  criterionNames: Record<string, string>;
  github: { handle: string; url: string } | null;
  firstLink: string | null;
  publicBaseUrl: string;
}

export type AiState = "connecting" | "failed" | "idle" | "listening" | "thinking" | "speaking";

export interface TranscriptLine {
  id: string;
  who: "agent" | "candidate";
  text: string;
  /** Seconds since interview start (or since this client joined when the start is unknown). */
  at: number;
  final: boolean;
}

export type RecordingView =
  | { state: "off" }
  | { state: "unsupported" }
  | { state: "starting" }
  | { state: "recording"; startedAt: number }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "failed"; message: string }
  | { state: "meeting" }
  | { state: "preview" };

export const PHASE_TITLE: Record<Phase, string> = {
  intro: "Intro and consent",
  behavioral: "Behavioral",
  background: "Background",
  technical: "Technical · worksheet",
  close: "Your questions",
};
export const PHASE_SHORT: Record<Phase, string> = {
  intro: "INTRO",
  behavioral: "BEHAVIORAL",
  background: "BACKGROUND",
  technical: "TECHNICAL",
  close: "CLOSE",
};
