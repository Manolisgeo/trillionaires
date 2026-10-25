"use client";

import { useEffect, useMemo } from "react";
import { RoomEvent, type Room } from "livekit-client";
import type { SimpleShape } from "@/lib/protocol";

/** The minimum shape of an Excalidraw element that sync and summary code relies on. */
export interface BoardElement {
  id: string;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  containerId?: string | null;
  boundElements?: readonly { id: string; type: string }[] | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  points?: readonly (readonly [number, number])[];
}

/** Transport for the shared worksheet. Live = LiveKit text streams; preview passes null and stays local. */
export interface BoardChannel {
  sendBoard(elements: readonly unknown[]): void;
  sendPad(text: string): void;
  onBoard(cb: (elements: unknown[]) => void): () => void;
  onPad(cb: (text: string) => void): () => void;
  /** The worksheet registers a snapshot so peers that join late receive the whole scene. */
  provideSnapshot(get: () => { elements: unknown[]; pad: string }): void;
}

const CLIENT = /^(candidate|board|bridge)-/;

/**
 * Topics "board" ({elements}) and "pad" ({text}) between candidate, board and bridge clients.
 * Handlers register once per room; late subscribers get the accumulated remote state.
 */
export function useLiveBoardChannel(room: Room): BoardChannel {
  const wiring = useMemo(() => {
    const boardSubs = new Set<(els: unknown[]) => void>();
    const padSubs = new Set<(t: string) => void>();
    const remote = new Map<string, BoardElement>();
    const state: { pad: string | null; snapshot: (() => { elements: unknown[]; pad: string }) | null } = { pad: null, snapshot: null };

    const send = (payload: unknown, topic: string, to?: string[]) => {
      void room.localParticipant.sendText(JSON.stringify(payload), { topic, destinationIdentities: to }).catch(() => {
        /* the next change re-sends; one dropped frame is not fatal */
      });
    };

    const channel: BoardChannel = {
      sendBoard: (elements) => send({ elements }, "board"),
      sendPad: (text) => send({ text }, "pad"),
      onBoard(cb) {
        boardSubs.add(cb);
        if (remote.size) cb([...remote.values()]);
        return () => void boardSubs.delete(cb);
      },
      onPad(cb) {
        padSubs.add(cb);
        if (state.pad !== null) cb(state.pad);
        return () => void padSubs.delete(cb);
      },
      provideSnapshot(get) {
        state.snapshot = get;
      },
    };
    return { channel, boardSubs, padSubs, remote, state, send };
  }, [room]);

  useEffect(() => {
    const { boardSubs, padSubs, remote, state, send } = wiring;
    const read = async (reader: { readAll: () => Promise<string> }): Promise<unknown> => {
      try {
        return JSON.parse(await reader.readAll());
      } catch {
        return null;
      }
    };
    room.registerTextStreamHandler("board", async (reader, info) => {
      if (!CLIENT.test(info.identity)) return;
      const v = (await read(reader)) as { elements?: unknown } | null;
      if (!v || !Array.isArray(v.elements)) return;
      const els = v.elements as BoardElement[];
      for (const e of els) {
        if (!e || typeof e.id !== "string") continue;
        const have = remote.get(e.id);
        if (!have || e.version >= have.version) remote.set(e.id, e);
      }
      for (const cb of boardSubs) cb(els);
    });
    room.registerTextStreamHandler("pad", async (reader, info) => {
      if (!CLIENT.test(info.identity)) return;
      const v = (await read(reader)) as { text?: unknown } | null;
      if (!v || typeof v.text !== "string") return;
      state.pad = v.text;
      for (const cb of padSubs) cb(v.text);
    });
    const onJoin = (p: { identity: string }) => {
      if (!CLIENT.test(p.identity) || !state.snapshot) return;
      const get = state.snapshot;
      // Give the newcomer a beat to register its handlers before the full scene arrives.
      window.setTimeout(() => {
        const snap = get();
        if (snap.elements.length) send({ elements: snap.elements }, "board", [p.identity]);
        if (snap.pad) send({ text: snap.pad }, "pad", [p.identity]);
      }, 1200);
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.unregisterTextStreamHandler("board");
      room.unregisterTextStreamHandler("pad");
    };
  }, [room, wiring]);

  return wiring.channel;
}

/** Agent shapes (`board.add`) to Excalidraw element skeletons. Ids are deterministic so two clients never double-draw. */
export function shapesToSkeletons(shapes: SimpleShape[], n: number): Record<string, unknown>[] {
  const ink = "#5a4aa8"; // violet: everything the AI marks
  const out: Record<string, unknown>[] = [];
  shapes.forEach((s, i) => {
    const id = `aperture-${n}-${i}`;
    const base = { id, x: s.x, y: s.y, strokeColor: ink, roughness: 0, strokeWidth: 2 };
    if (s.kind === "rect" || s.kind === "ellipse") {
      out.push({
        ...base,
        type: s.kind === "rect" ? "rectangle" : "ellipse",
        width: s.w ?? 180,
        height: s.h ?? 90,
        ...(s.label ? { label: { text: s.label, fontSize: 18, fontFamily: 2, strokeColor: ink } } : {}),
      });
    } else if (s.kind === "text") {
      out.push({ ...base, type: "text", text: s.label ?? "", fontSize: 20, fontFamily: 2 });
    } else if (s.kind === "arrow") {
      const dx = (s.toX ?? s.x + 120) - s.x;
      const dy = (s.toY ?? s.y) - s.y;
      out.push({
        ...base,
        type: "arrow",
        points: [[0, 0], [dx, dy]],
        endArrowhead: "arrow",
        ...(s.label ? { label: { text: s.label, fontSize: 16, fontFamily: 2, strokeColor: ink } } : {}),
      });
    }
  });
  return out;
}

/** Plain-text description of the board for the agent: shapes, labels, arrows as A -> B, free text. */
export function summarizeBoard(all: readonly BoardElement[]): string {
  const els = all.filter((e) => !e.isDeleted);
  const byId = new Map(els.map((e) => [e.id, e]));
  const labelOf = new Map<string, string>(); // container id -> its bound text
  const freeText: string[] = [];
  for (const e of els) {
    if (e.type !== "text" || !e.text) continue;
    if (e.containerId && byId.has(e.containerId)) labelOf.set(e.containerId, e.text.replace(/\s+/g, " ").trim());
    else freeText.push(e.text.replace(/\s+/g, " ").trim());
  }
  const nodes = els.filter((e) => e.type !== "text" && e.type !== "arrow" && e.type !== "line" && e.type !== "freedraw");
  const arrows = els.filter((e) => e.type === "arrow");
  const strokes = els.filter((e) => e.type === "freedraw" || e.type === "line").length;
  const nodeName = (e: BoardElement) => labelOf.get(e.id) ?? `unlabelled ${e.type}`;

  const nearest = (px: number, py: number): BoardElement | null => {
    let best: BoardElement | null = null;
    let bestD = 40; // px of slack around a shape
    for (const n of nodes) {
      const dx = Math.max(n.x - px, 0, px - (n.x + n.width));
      const dy = Math.max(n.y - py, 0, py - (n.y + n.height));
      const d = Math.hypot(dx, dy);
      if (d <= bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };
  const endpoint = (a: BoardElement, which: "start" | "end"): string => {
    const bound = which === "start" ? a.startBinding?.elementId : a.endBinding?.elementId;
    const b = bound ? byId.get(bound) : undefined;
    if (b) return nodeName(b);
    const p = a.points?.[which === "start" ? 0 : a.points.length - 1] ?? [0, 0];
    const hit = nearest(a.x + p[0], a.y + p[1]);
    return hit ? nodeName(hit) : "open end";
  };

  const kinds = new Map<string, number>();
  for (const n of nodes) kinds.set(n.type, (kinds.get(n.type) ?? 0) + 1);
  const lines: string[] = [];
  if (!els.length) lines.push("The board is empty.");
  else {
    const parts = [...kinds].map(([k, c]) => `${c} ${k}${c > 1 ? "s" : ""}`);
    lines.push(`Shapes: ${nodes.length}${parts.length ? ` (${parts.join(", ")})` : ""}. Arrows: ${arrows.length}. Freehand strokes and lines: ${strokes}.`);
    const labels = nodes.map((n) => labelOf.get(n.id)).filter((x): x is string => Boolean(x));
    if (labels.length) lines.push(`Labels: ${labels.map((l) => `"${l}"`).join(", ")}.`);
    if (arrows.length) {
      const items = arrows.map((a) => {
        const lab = labelOf.get(a.id);
        return `${endpoint(a, "start")} -> ${endpoint(a, "end")}${lab ? ` (${lab})` : ""}`;
      });
      lines.push(`Arrows: ${items.join("; ")}.`);
    }
    if (freeText.length) lines.push(`Text: ${freeText.map((t) => `"${t}"`).join(", ")}.`);
  }
  return lines.join("\n");
}
