import type { ReactNode } from "react";
import { cx } from "./cx";

export type StampVariant = "ai" | "neutral" | "recording" | "dashed";

const VARIANT: Record<StampVariant, string> = {
  ai: "border-stamp text-stamp border-[1.5px]",
  neutral: "border-ink-2 text-ink-2 border-[1.5px]",
  recording: "border-redline text-redline border-[1.5px]",
  dashed: "border-rule-strong text-ink-2 border border-dashed",
};

/**
 * Rubber-stamp label. Presses on mount and whenever `pressKey` (or string children) changes.
 * `rotate` in degrees (e.g. -1.5).
 */
export function Stamp({
  variant = "neutral",
  rotate = 0,
  pressKey,
  size = "sm",
  className,
  children,
}: {
  variant?: StampVariant;
  rotate?: number;
  pressKey?: string | number;
  size?: "sm" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const key = pressKey ?? (typeof children === "string" ? children : undefined);
  return (
    <span
      key={key}
      style={{ ["--stamp-rot" as string]: `${rotate}deg`, transform: `rotate(${rotate}deg)` }}
      className={cx(
        "stamp-press inline-flex w-fit items-center gap-1.5 rounded-[3px] font-bold uppercase",
        size === "sm" ? "px-2 py-0.5 text-[11px] tracking-[0.12em]" : "rounded px-3.5 py-2 text-xl tracking-[0.08em]",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Red dot + mono label. Red means recording, nowhere else. */
export function RecordingStamp({ label = "RECORDING", clock }: { label?: string; clock?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[3px] border-[1.5px] border-[#E06A5F] px-2.5 py-1 text-white">
      <span aria-hidden="true" className="size-2 rounded-full bg-[#E2554A]" />
      <span className="font-mono text-[13px] tracking-[0.08em]">
        {label}
        {clock ? ` ${clock}` : ""}
      </span>
    </span>
  );
}
