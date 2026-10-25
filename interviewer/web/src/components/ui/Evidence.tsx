import { mmss } from "@/lib/format";
import { cx } from "./cx";
import { SlipMarker } from "./Slip";

/**
 * One quote, filed like a slip: the call tag the question carried in the room ("Q2.1"), the timecode, the transcript
 * line ("T-004") and the verbatim words under the same violet wash the CV line got. Seeks the recording.
 * The rule at the left is 1px neutral; violet is spent on the tag and the wash, which are what the AI marks.
 */
export function EvidenceQuote({
  t,
  quote,
  tag,
  line,
  onSeek,
  href,
  className,
}: {
  t: number;
  quote: string;
  /** Question call tag, the same one the slip showed in the room. */
  tag?: string | null;
  /** Transcript call number, e.g. "T-004". */
  line?: string | null;
  onSeek?: (t: number) => void;
  href?: string;
  className?: string;
}) {
  const label = `${tag ? `${tag}, ` : ""}play from ${mmss(t)}: ${quote}`;
  const inner = (
    <>
      <span className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 sm:w-[188px]">
        {tag ? <SlipMarker tag={tag} animate={false} /> : null}
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-stamp tabular-nums">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 1l7 4-7 4z" fill="currentColor" />
          </svg>
          {mmss(t)}
          {line ? <span className="font-normal text-muted"> · {line}</span> : null}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="slip-highlight box-decoration-clone px-0.5">&ldquo;{quote}&rdquo;</span>
      </span>
    </>
  );
  const cls = cx(
    "flex min-h-11 w-full flex-col gap-x-3 gap-y-1.5 border-l border-rule py-2 pr-3 pl-3 text-left text-sm leading-[21px] text-ink no-underline hover:bg-stamp-tint hover:text-ink sm:flex-row",
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls} aria-label={label}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onSeek?.(t)} className={cx(cls, "cursor-pointer")} aria-label={label}>
      {inner}
    </button>
  );
}
