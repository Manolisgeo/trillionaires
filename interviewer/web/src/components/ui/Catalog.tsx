import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export function CallNumber({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono tabular-nums", className)}>{children}</span>;
}

/** Typewriter readout: timecodes, phase clocks, page:line. The only chrome that moves. */
export function MonoReadout({
  label,
  children,
  tone = "default",
  className,
  live,
}: {
  label?: string;
  children: ReactNode;
  tone?: "default" | "muted" | "stamp";
  className?: string;
  live?: boolean;
}) {
  return (
    <span
      role={live ? "timer" : undefined}
      className={cx(
        "font-mono text-[13px] tabular-nums tracking-[0.04em]",
        tone === "muted" && "text-muted",
        tone === "stamp" && "text-stamp",
        className,
      )}
    >
      {label ? <span className="mr-2 text-muted">{label}</span> : null}
      {children}
    </span>
  );
}

/** Mono small-caps heading used for SERIES / LEDGER / SCOPE NOTE sections. */
export function SeriesHeading({ children, as: Tag = "h2", className }: { children: ReactNode; as?: ElementType; className?: string }) {
  return <Tag className={cx("m-0 font-mono text-[13px] font-bold tracking-[0.14em] text-ink-2 uppercase", className)}>{children}</Tag>;
}

/** White catalog card with a 3px red top rule (the one red-rule surface). */
export function CatalogCard({
  callNo,
  source,
  kicker,
  right,
  ruled,
  dashed,
  as: Tag = "article",
  className,
  children,
  ...aria
}: {
  callNo?: string;
  source?: string;
  kicker?: ReactNode;
  right?: ReactNode;
  /** true: the whole card is ruled paper. "strips": rules only behind the kicker row (and any `ruled` row you add), so body text is never struck through. */
  ruled?: boolean | "strips";
  dashed?: boolean;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const hasKicker = callNo || source || kicker || right;
  return (
    <Tag
      {...aria}
      className={cx(
        "flex flex-col border bg-card px-6",
        // A ruled card sits on the 24px armature: every row is a multiple of 24px so text baselines land on the rules.
        ruled === "strips" ? "gap-0 pt-0 pb-3 [&_p]:m-0" : ruled ? "ruled gap-0 pt-0 pb-3 [&_p]:m-0" : "gap-2 pt-3.5 pb-[18px]",
        dashed ? "border-dashed border-rule-strong" : "border-rule border-t-[3px] border-t-redline",
        className,
      )}
    >
      {hasKicker ? (
        <div className={cx("flex flex-wrap justify-between gap-x-3 font-mono text-[13px] tracking-[0.06em] text-muted", ruled && "min-h-6 leading-6", ruled === "strips" && "ruled")}>
          <span>
            {callNo}
            {callNo && kicker ? " · " : ""}
            {kicker}
          </span>
          <span className="text-stamp">{right ?? source}</span>
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
