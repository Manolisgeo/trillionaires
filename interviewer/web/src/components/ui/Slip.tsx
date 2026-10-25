import type { ReactNode } from "react";
import { cx } from "./cx";

/** Violet call tag in the margin ("Q2.3 →"). Slides in from the margin; the same tag is the report citation. */
export function SlipMarker({ tag, className, animate = true }: { tag: string; className?: string; animate?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-l-[3px] bg-stamp pr-2.5 pl-2 font-mono text-xs text-white",
        animate && "slip-in",
        className,
      )}
    >
      {tag}
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h7M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    </span>
  );
}

/** Violet wash with a 2px underline, for the line being asked about. */
export function SlipHighlight({ children, className }: { children: ReactNode; className?: string }) {
  return <mark className={cx("slip-highlight bg-transparent text-inherit", className)}>{children}</mark>;
}
export const slipHighlightClass = "slip-highlight";
