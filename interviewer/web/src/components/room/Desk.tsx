"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Cataloguing, EmptyState, FolderTabs, type TabDef } from "@/components/ui";
import type { SimpleShape } from "@/lib/protocol";
import type { BoardChannel } from "./board";
import type { CvMatchInfo } from "./CvViewer";
import { BrowserView } from "./BrowserView";
import { hostOf, type DeskState, type DeskTab } from "./deskState";
import type { RoomData } from "./types";
import type { WorksheetHandle } from "./Worksheet";

const CvViewer = dynamic(() => import("./CvViewer"), { ssr: false, loading: () => <Cataloguing label="Opening the CV" className="p-6" /> });
const Worksheet = dynamic(() => import("./Worksheet"), { ssr: false, loading: () => <Cataloguing label="Opening the worksheet" className="p-6" /> });

const PREFIX = "desk";

interface Props {
  data: RoomData;
  desk: DeskState;
  tag: string | null;
  channel: BoardChannel | null;
  adds: { n: number; shapes: SimpleShape[] }[];
  applyAdds: boolean;
  uploadFor: string | null;
  onPaste?: (where: "board" | "pad", chars: number) => void;
  onCvMatch?: (m: CvMatchInfo | null) => void;
  worksheetRef?: Ref<WorksheetHandle>;
  /** When set, the desk shows only the worksheet (board-only participant). */
  only?: DeskTab;
  className?: string;
  /** Strip under the document (live captions). */
  below?: ReactNode;
  autoPick?: boolean;
}

/** Exactly one document owns the desk at a time: folder tabs hard-swap it, never tile. */
export function Desk({ data, desk, tag, channel, adds, applyAdds, uploadFor, onPaste, onCvMatch, worksheetRef, only, className, below, autoPick }: Props) {
  const [tab, setTab] = useState<DeskTab>(only ?? "cv");
  const seen = useRef(0);

  // The agent's "screen" and "board.add" messages pick the document; the candidate can still flip tabs by hand.
  useEffect(() => {
    if (only) return;
    if (desk.focus.seq === seen.current) return;
    seen.current = desk.focus.seq;
    if (desk.focus.tab) setTab(desk.focus.tab);
  }, [desk.focus, only]);

  const tabs: TabDef[] = [
    {
      id: "cv",
      label: (
        <>
          CV<span className="hidden sm:inline"> · {data.cv?.label ?? "none on file"}</span>
        </>
      ),
    },
    {
      id: "browser",
      label: desk.browser.url ? (
        <>
          <span className="sm:hidden">Browser</span>
          <span className="hidden sm:inline">{hostOf(desk.browser.url)}</span>
        </>
      ) : (
        "Browser"
      ),
    },
    { id: "board", label: "Worksheet" },
  ];
  const current: DeskTab = only ?? tab;

  const panel = (id: DeskTab, children: ReactNode) => {
    const on = current === id;
    return (
      <div
        role="tabpanel"
        id={`${PREFIX}-panel-${id}`}
        aria-labelledby={only ? undefined : `${PREFIX}-tab-${id}`}
        aria-label={only ? "Worksheet" : undefined}
        inert={!on}
        className={on ? "absolute inset-0 overflow-hidden" : "pointer-events-none invisible absolute inset-0 overflow-hidden opacity-0"}
      >
        {children}
      </div>
    );
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {only ? null : <FolderTabs tabs={tabs} value={tab} onChange={(id) => setTab(id as DeskTab)} idPrefix={PREFIX} />}
      <div className={`relative flex-1 border border-rule bg-card lg:min-h-0 ${current === "board" ? "min-h-[800px]" : "min-h-[480px]"}`}>
        {only ? null : panel("cv", data.cv ? <CvViewer url={data.cv.url} label="CV" highlight={desk.highlight} tag={tag} onMatch={onCvMatch} autoPick={autoPick} /> : <div className="p-6"><EmptyState title="No CV on file">This candidate did not upload a CV, so there is nothing to point at.</EmptyState></div>)}
        {only ? null : panel("browser", <BrowserView browser={desk.browser} />)}
        {panel(
          "board",
          <div className="h-full p-3 sm:p-4">
            <Worksheet channel={channel} adds={adds} applyAdds={applyAdds} uploadFor={uploadFor} onPaste={onPaste} handleRef={worksheetRef} />
          </div>,
        )}
      </div>
      {below}
    </div>
  );
}
