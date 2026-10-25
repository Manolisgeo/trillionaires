import type { ReactNode } from "react";
import { cx } from "./cx";

/** Empty drawer: says what is missing and what to do. */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-start gap-2 border border-dashed border-rule-strong bg-card px-6 py-8", className)}>
      <h2 className="m-0 text-base font-bold">{title}</h2>
      {children ? <p className="m-0 max-w-[62ch] text-sm leading-[22px] text-ink-2">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Spinner-free loading: a mono line with ticking dots. */
export function Cataloguing({ label = "Cataloguing", className }: { label?: string; className?: string }) {
  return (
    <p role="status" className={cx("m-0 font-mono text-[13px] tracking-[0.06em] text-muted", className)}>
      <span className="tick-dots">{label}</span>
    </p>
  );
}

/** Error that names the problem and the recovery. */
export function ErrorNote({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cx("flex flex-col gap-1.5 border border-[#E3B1AB] bg-[#FBF1F0] px-4 py-3 text-sm text-ink", className)}>
      <b className="text-[#A8322A]">{title}</b>
      {children ? <p className="m-0 leading-[21px]">{children}</p> : null}
      {action}
    </div>
  );
}
