"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI, ExcalidrawProps, BinaryFiles, UIOptions } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import { Cataloguing } from "@/components/ui";
import { api } from "@/lib/client";
import type { SimpleShape } from "@/lib/protocol";
import { shapesToSkeletons, summarizeBoard, type BoardChannel, type BoardElement } from "./board";
import "./room.css";

// Excalidraw with a trimmed main menu (no Excalidraw social links or account prompts): only Help and Clear canvas.
const Excalidraw = dynamic(
  () =>
    import("@excalidraw/excalidraw").then((m) => {
      function Trimmed(props: ExcalidrawProps & { menu?: boolean }) {
        const { menu = true, ...rest } = props;
        return (
          <m.Excalidraw {...rest}>
            {menu ? (
              <m.MainMenu>
                <m.MainMenu.DefaultItems.ClearCanvas />
                <m.MainMenu.DefaultItems.Help />
              </m.MainMenu>
            ) : null}
          </m.Excalidraw>
        );
      }
      return Trimmed;
    }),
  { ssr: false, loading: () => <Cataloguing label="Opening the worksheet" className="p-4" /> },
);

let excalidrawModule: Promise<typeof import("@excalidraw/excalidraw")> | null = null;
const loadExcalidraw = () => (excalidrawModule ??= import("@excalidraw/excalidraw"));

const UI_EDIT: Partial<UIOptions> = {
  canvasActions: { loadScene: false, saveToActiveFile: false, saveAsImage: false, export: false, toggleTheme: false, changeViewBackgroundColor: false },
  tools: { image: false },
};
const UI_VIEW: Partial<UIOptions> = {
  canvasActions: { loadScene: false, saveToActiveFile: false, saveAsImage: false, export: false, toggleTheme: false, changeViewBackgroundColor: false, clearCanvas: false },
};
const INITIAL = { appState: { viewBackgroundColor: "#ffffff", currentItemStrokeColor: "#1e262d", currentItemRoughness: 0, currentItemFontFamily: 2 }, scrollToContent: false } as const;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export interface WorksheetHandle {
  /** Push the latest board + pad to the server now (called on leave). */
  flush(): Promise<void>;
}

interface Props {
  channel: BoardChannel | null;
  adds: { n: number; shapes: SimpleShape[] }[];
  /** Only the board owner (candidate client, or the Meet board participant) turns `board.add` into shapes. */
  applyAdds: boolean;
  readOnly?: boolean;
  /** Interview id to POST board state to (throttled 2s). */
  uploadFor?: string | null;
  onPaste?: (where: "board" | "pad", chars: number) => void;
  handleRef?: Ref<WorksheetHandle>;
}

export default function Worksheet({ channel, adds, applyAdds, readOnly = false, uploadFor = null, onPaste, handleRef }: Props) {
  const [xl, setXl] = useState<ExcalidrawImperativeAPI | null>(null);
  const [pad, setPad] = useState("");
  const padRef = useRef("");
  const filesRef = useRef<BinaryFiles>({});
  const sent = useRef(new Map<string, number>());
  const boardTimer = useRef<number | null>(null);
  const padTimer = useRef<number | null>(null);
  const upTimer = useRef<number | null>(null);
  const upDirty = useRef(false);
  const lastPngKey = useRef("");
  const lastLocalPad = useRef(0);
  const applied = useRef(0);

  const upload = useCallback(async () => {
    upTimer.current = null;
    if (!uploadFor || !xl || !upDirty.current) return;
    upDirty.current = false;
    const els = xl.getSceneElements();
    const summary = summarizeBoard(els as unknown as BoardElement[]);
    let png: string | undefined;
    const key = els.map((e) => `${e.id}:${e.version}`).join("|");
    if (els.length && key !== lastPngKey.current) {
      try {
        const ex = await loadExcalidraw();
        const blob = await ex.exportToBlob({
          elements: els,
          appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
          files: filesRef.current,
          mimeType: "image/png",
          exportPadding: 16,
          maxWidthOrHeight: 1600,
        });
        png = await blobToDataUrl(blob);
        lastPngKey.current = key;
      } catch {
        /* summary still goes up without the picture */
      }
    }
    try {
      await api.interviews.board(uploadFor, { summary, padText: padRef.current, ...(png ? { png } : {}) });
    } catch {
      upDirty.current = true; // retried on the next change
    }
  }, [uploadFor, xl]);

  const scheduleUpload = useCallback(() => {
    if (!uploadFor) return;
    upDirty.current = true;
    if (upTimer.current == null) upTimer.current = window.setTimeout(() => void upload(), 2000);
  }, [uploadFor, upload]);

  useImperativeHandle(
    handleRef,
    () => ({
      async flush() {
        if (upTimer.current != null) window.clearTimeout(upTimer.current);
        upTimer.current = null;
        await upload();
      },
    }),
    [upload],
  );

  const broadcast = useCallback(() => {
    boardTimer.current = null;
    if (!xl || !channel) return;
    const delta = xl.getSceneElementsIncludingDeleted().filter((e) => (sent.current.get(e.id) ?? -1) < e.version);
    if (!delta.length) return;
    for (const e of delta) sent.current.set(e.id, e.version);
    channel.sendBoard(delta);
  }, [xl, channel]);

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], _appState: unknown, files: BinaryFiles) => {
      filesRef.current = files;
      if (readOnly) return;
      for (const e of elements) {
        if ((sent.current.get(e.id) ?? -1) < e.version) {
          if (channel && boardTimer.current == null) boardTimer.current = window.setTimeout(broadcast, 400);
          scheduleUpload();
          return;
        }
      }
    },
    [broadcast, channel, readOnly, scheduleUpload],
  );

  // Remote board: merge by element id, keeping the higher version (Excalidraw's reconcile), without echoing it back.
  useEffect(() => {
    if (!channel || !xl) return;
    channel.provideSnapshot(() => ({ elements: xl.getSceneElements() as unknown[], pad: padRef.current }));
    return channel.onBoard(async (remote) => {
      const ex = await loadExcalidraw();
      const remoteEls = remote as RemoteExcalidrawElement[];
      const merged = ex.reconcileElements(xl.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[], remoteEls, xl.getAppState());
      const byId = new Map(remoteEls.map((e) => [e.id, e]));
      for (const m of merged) {
        const r = byId.get(m.id);
        if (r && r.version === m.version && r.versionNonce === m.versionNonce) sent.current.set(m.id, m.version);
      }
      xl.updateScene({ elements: merged, captureUpdate: ex.CaptureUpdateAction.NEVER });
      if (readOnly) xl.scrollToContent(undefined, { fitToContent: true, animate: false });
    });
  }, [channel, xl, readOnly]);

  // Agent shapes: drawn once, in violet, by the board owner only.
  useEffect(() => {
    if (!applyAdds || !xl || adds.length <= applied.current) return;
    const fresh = adds.slice(applied.current);
    applied.current = adds.length;
    void (async () => {
      const ex = await loadExcalidraw();
      for (const a of fresh) {
        const existing = new Set(xl.getSceneElementsIncludingDeleted().map((e) => e.id));
        const skeletons = shapesToSkeletons(a.shapes, a.n).filter((s) => !existing.has(String(s.id)));
        if (!skeletons.length) continue;
        const created = ex.convertToExcalidrawElements(skeletons as never);
        xl.updateScene({ elements: [...xl.getSceneElementsIncludingDeleted(), ...created], captureUpdate: ex.CaptureUpdateAction.IMMEDIATELY });
        xl.scrollToContent(created, { fitToContent: true, animate: false });
      }
    })();
  }, [adds, xl, applyAdds]);

  // Pad
  useEffect(() => {
    if (!channel) return;
    return channel.onPad((text) => {
      if (Date.now() - lastLocalPad.current < 1500 || padTimer.current != null) return; // never clobber what is being typed
      padRef.current = text;
      setPad(text);
    });
  }, [channel]);

  const onPadChange = (text: string) => {
    padRef.current = text;
    lastLocalPad.current = Date.now();
    setPad(text);
    if (padTimer.current == null) {
      padTimer.current = window.setTimeout(() => {
        padTimer.current = null;
        channel?.sendPad(padRef.current);
      }, 400);
    }
    scheduleUpload();
  };

  useEffect(
    () => () => {
      for (const t of [boardTimer, padTimer, upTimer]) if (t.current != null) window.clearTimeout(t.current);
    },
    [],
  );

  return (
    <div className="room-board @container flex h-full min-h-0 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-3 @3xl:flex-row">
        <div className="flex min-h-[320px] min-w-0 flex-1 flex-col gap-1">
          <div className="relative min-h-0 flex-1 border border-rule bg-white">
            <div className="absolute inset-0">
              <Excalidraw
                excalidrawAPI={setXl}
                onChange={onChange}
                initialData={INITIAL}
                theme="light"
                langCode="en"
                menu={!readOnly}
                viewModeEnabled={readOnly}
                handleKeyboardGlobally={false}
                autoFocus={false}
                UIOptions={readOnly ? UI_VIEW : UI_EDIT}
                onPaste={(data) => {
                  onPaste?.("board", (data.text ?? "").length);
                  return true;
                }}
              />
            </div>
          </div>
          {readOnly ? null : (
            <p className="m-0 font-mono text-[12px] text-muted">Board · what Kimma draws appears in violet · both of you can edit</p>
          )}
        </div>
        {readOnly ? null : (
          <div className="flex min-h-[180px] flex-col gap-1 @3xl:w-[300px] @3xl:flex-none">
            <label htmlFor="room-pad" className="font-mono text-[12px] tracking-[0.12em] text-muted">
              PAD · PLAIN TEXT
            </label>
            <textarea
              id="room-pad"
              value={pad}
              onChange={(e) => onPadChange(e.target.value)}
              onPaste={(e) => onPaste?.("pad", e.clipboardData.getData("text").length)}
              spellCheck={false}
              placeholder="Notes, pseudocode or an outline. Kimma can read this pad."
              className="room-pad min-h-[160px] flex-1 resize-none border border-rule bg-white px-3 py-0 font-mono text-[14px] text-ink"
            />
          </div>
        )}
      </div>
    </div>
  );
}
