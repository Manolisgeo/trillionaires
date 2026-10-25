"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { Cataloguing, ErrorNote, SlipMarker } from "@/components/ui";
import { escapeHtml, findQuote, lineRows, markedHtml, pickDemoLine, type QuoteMatch, type TextItemLike } from "./cv-match";
import "./room.css";

// The worker must be configured in this module (the one that renders <Document>), and this module is client-only.
// It is served by app/room/pdfjs-worker/route.ts: pnpm does not hoist pdfjs-dist, and a bundler import breaks the file.
pdfjs.GlobalWorkerOptions.workerSrc = "/room/pdfjs-worker";

export interface CvHighlight {
  id: string;
  quote: string;
  page?: number;
  note?: string;
}
export interface CvMatchInfo {
  found: boolean;
  page: number | null;
  line: number | null;
}

interface Props {
  url: string;
  highlight: CvHighlight | null;
  /** Call tag for the slip marker, e.g. "Q2.3". */
  tag: string | null;
  maxPageWidth?: number;
  onMatch?: (info: CvMatchInfo | null) => void;
  label?: string;
  /** Preview only: when the scripted quote is not in this CV, mark a real line instead so the slip is still demonstrated. */
  autoPick?: boolean;
}

const SLIP_W = 68;
/** Phone page widths: about 10px, 12px and 15px CV type. The pane scrolls sideways; the page is never shrunk below readable. */
const ZOOMS = [600, 760, 920];
/** Left padding that keeps the slip in the margin, never over the CV text. */
const MARGIN_W = 80;

export default function CvViewer({ url, highlight, tag, maxPageWidth = 640, onMatch, label = "CV", autoPick = false }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pages, setPages] = useState<TextItemLike[][] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [slip, setSlip] = useState<{ top: number; left: number } | null>(null);
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({});
  const scrolledFor = useRef<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Phones: keep the page at a readable scale and let the pane scroll sideways, instead of shrinking the CV to 7px type.
  const narrow = width > 0 && width < 560;
  const pageWidth = narrow ? ZOOMS[zoom] : Math.max(240, Math.min(maxPageWidth, width - MARGIN_W - 24));
  const rows = useMemo(() => (pages ? pages.map((items) => lineRows(items)) : []), [pages]);

  const match: QuoteMatch | null = useMemo(() => {
    if (!highlight || !pages) return null;
    const found = findQuote(pages, highlight.quote, highlight.page);
    if (found || !autoPick) return found;
    const demo = pickDemoLine(pages);
    return demo ? findQuote(pages, demo, 1) : null;
  }, [highlight, pages, autoPick]);

  useEffect(() => {
    if (!highlight) return onMatch?.(null);
    if (!pages) return;
    onMatch?.({ found: Boolean(match), page: match?.page ?? null, line: match?.line ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, pages, match]);

  // Must be referentially stable: react-pdf re-renders the text layer whenever this callback changes.
  const onTextLayer = useCallback(() => setLayoutTick((t) => t + 1), []);

  const renderer = useCallback(
    ({ pageNumber, itemIndex, str }: { pageNumber: number; itemIndex: number; str: string }) =>
      match && match.page === pageNumber ? markedHtml(str, match.ranges.get(itemIndex)) : escapeHtml(str),
    [match],
  );

  // Position the slip in the margin beside the first marked fragment, then scroll it into view once per highlight.
  useLayoutEffect(() => {
    const host = content.current;
    const box = scroller.current;
    if (!host || !box || !match) {
      setSlip(null);
      return;
    }
    const mark = host.querySelector<HTMLElement>("mark.slip-mark");
    const sheet = mark?.closest<HTMLElement>("[data-sheet]");
    if (!mark || !sheet) {
      setSlip(null);
      return;
    }
    const h = host.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const s = sheet.getBoundingClientRect();
    const sheetLeft = s.left - h.left;
    const next = {
      top: m.top - h.top + m.height / 2 - 12,
      left: sheetLeft >= SLIP_W + 8 ? sheetLeft - SLIP_W : sheetLeft,
    };
    setSlip((prev) => (prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 ? prev : next));
    const key = `${highlight?.id}:${highlight?.quote}`;
    if (scrolledFor.current !== key) {
      scrolledFor.current = key;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, next.top - box.clientHeight / 3), left: 0, behavior: reduce ? "auto" : "smooth" });
    }
  }, [match, layoutTick, width, highlight]);

  useEffect(() => {
    if (!highlight) {
      setSlip(null);
      scrolledFor.current = null;
    }
  }, [highlight]);

  const onDocLoad = useCallback(async (pdf: { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> }) => {
    setNumPages(pdf.numPages);
    try {
      const all: TextItemLike[][] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const tc = await (await pdf.getPage(n)).getTextContent();
        all.push(tc.items as TextItemLike[]);
      }
      setPages(all);
    } catch {
      setPages([]);
    }
  }, []);

  const missing = Boolean(highlight && pages && !match);

  return (
    <div ref={scroller} className="room-cv relative h-full min-h-0 overflow-auto bg-card" data-testid="cv-viewer">
      {narrow ? (
        <div className="sticky top-0 left-0 z-20 flex w-full items-center gap-2 border-b border-rule bg-card px-3 py-1.5">
          <button type="button" aria-label="Smaller CV type" disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))} className="min-h-11 min-w-11 cursor-pointer border border-rule-strong bg-card font-mono text-sm font-bold text-ink disabled:cursor-not-allowed disabled:text-muted">
            A&minus;
          </button>
          <button type="button" aria-label="Larger CV type" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} className="min-h-11 min-w-11 cursor-pointer border border-rule-strong bg-card font-mono text-sm font-bold text-ink disabled:cursor-not-allowed disabled:text-muted">
            A+
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">Scroll sideways</span>
          <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center px-1 text-[13px] font-semibold text-ink underline underline-offset-4">
            Open full CV
          </a>
        </div>
      ) : null}
      <div ref={content} className="relative mx-auto flex flex-col items-center py-6 pr-3 pl-20 sm:py-9 sm:pr-6" style={{ minWidth: narrow ? pageWidth + MARGIN_W + 12 : 0 }}>
        {missing ? (
          <p role="status" className="mb-4 w-full max-w-[640px] border border-dashed border-rule-strong px-3 py-2 font-mono text-[13px] text-ink-2">
            Aperture is asking about a line this page view could not locate. The question card above names it.
          </p>
        ) : null}
        {loadError ? (
          <ErrorNote title="The CV could not be opened" action={<a href={url} target="_blank" rel="noreferrer noopener">Open the PDF in a new tab</a>}>
            {loadError} Aperture can still ask about it; read the question card.
          </ErrorNote>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocLoad}
            onLoadError={(e) => setLoadError(e.message || "The file is not a readable PDF.")}
            loading={<Cataloguing label="Opening the CV" />}
            error={null}
            noData={<p className="m-0 font-mono text-[13px] text-muted">No CV on file.</p>}
            className="flex flex-col items-center"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div key={n} className="mb-6 last:mb-0" style={{ width: pageWidth }}>
                <div className="mb-1 text-right font-mono text-[11px] text-muted" aria-hidden="true">
                  {label} · p. {n} / {numPages}
                </div>
                <div data-sheet data-page={n} className="relative bg-white shadow-sheet">
                  <Page
                    pageNumber={n}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    customTextRenderer={renderer}
                    onRenderTextLayerSuccess={onTextLayer}
                    onLoadSuccess={(pg) => setSizes((s) => (s[n]?.w === pg.originalWidth && s[n]?.h === pg.originalHeight ? s : { ...s, [n]: { w: pg.originalWidth, h: pg.originalHeight } }))}
                    loading={<div style={{ width: pageWidth, height: pageWidth * 1.3 }} />}
                  />
                  <LineGutter rows={rows[n - 1]} size={sizes[n]} pageWidth={pageWidth} active={match && match.page === n ? match.line : null} />
                </div>
              </div>
            ))}
          </Document>
        )}
        {slip && tag ? (
          <div key={`${highlight?.id}:${tag}`} className="pointer-events-none absolute z-10" style={{ top: slip.top, left: slip.left }} title={highlight?.note}>
            <SlipMarker tag={tag} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Line numbers in the page margin, like a typed finding aid. "Source: your CV, page 1, line 4" can be found by eye. */
function LineGutter({ rows, size, pageWidth, active }: { rows: ReturnType<typeof lineRows> | undefined; size: { w: number; h: number } | undefined; pageWidth: number; active: number | null }) {
  if (!rows?.length || !size) return null;
  const k = pageWidth / size.w;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 select-none">
      {rows.map((r) => {
        const centre = (size.h - r.y) * k - r.size * k * 0.3;
        const on = r.n === active;
        return (
          <span
            key={r.n}
            className={`absolute right-1 font-mono text-[11px] leading-[14px] tabular-nums ${on ? "font-bold text-stamp" : "text-muted"}`}
            style={{ top: centre - 7 }}
          >
            {r.n}
          </span>
        );
      })}
    </div>
  );
}
