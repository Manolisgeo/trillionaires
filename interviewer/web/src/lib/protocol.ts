import type { Phase, IntegritySignal } from "./types";

// topic "desk": agent → all clients
export type DeskMsg =
  | { type: "phase"; phase: Phase; index: number; total: number; endsAt: number | null }   // endsAt = epoch ms
  | { type: "screen"; view: "idle" | "cv" | "browser" | "question" }                       // what the Agent Screen shows
  | { type: "question"; text: string; kind: "core" | "probe" }
  | { type: "cv.highlight"; id: string; quote: string; page?: number; note?: string }      // client fuzzy-finds quote in the PDF text layer, marks + scrolls
  | { type: "cv.clear" }
  | { type: "browser.session"; liveViewUrl: string | null }
  | { type: "browser.navigated"; url: string; title: string }
  | { type: "board.add"; shapes: SimpleShape[] }                                           // applied ONLY by the candidate client (board owner)
  | { type: "ended"; reportUrl: string | null };
export interface SimpleShape { kind: "rect" | "ellipse" | "text" | "arrow"; x: number; y: number; w?: number; h?: number; label?: string; toX?: number; toY?: number }

// topic "board": client ↔ client  { elements: ExcalidrawElement[] }  (throttled 400 ms, merge by element id keeping higher version)
// topic "pad":   client ↔ client  { text: string }
// topic "control": candidate → agent
export type ControlMsg = { type: "finished_answering" } | { type: "request_human" } | { type: "integrity"; signal: IntegritySignal };
