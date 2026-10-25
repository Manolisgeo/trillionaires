import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx";

/** Ledger: white sheet with an ink rule under the title row; the table scrolls inside its own box on narrow screens. */
export function Ledger({ title, aside, children, minWidth = 760, className, ...aria }: { title: string; aside?: ReactNode; children: ReactNode; minWidth?: number; className?: string; "aria-label"?: string }) {
  return (
    <section aria-label={aria["aria-label"] ?? title} className={cx("border border-rule bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-3.5">
        <h2 className="m-0 font-mono text-[13px] font-bold tracking-[0.14em]">{title}</h2>
        {aside ? <span className="text-sm text-muted">{aside}</span> : null}
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} table`}>
        <table className="w-full border-collapse text-left text-sm leading-5" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </section>
  );
}
export const LedgerHead = ({ children }: { children: ReactNode }) => (
  <thead>
    <tr className="text-muted">{children}</tr>
  </thead>
);
export const LedgerTh = ({ mono, className, ...p }: ThHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) => (
  <th scope="col" className={cx("px-3 py-2.5 text-xs tracking-[0.08em] first:pl-5 last:pr-5", mono ? "font-mono font-normal" : "font-semibold uppercase", className)} {...p} />
);
export const LedgerRow = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cx("border-t border-rule-faint hover:bg-board", className)} {...p} />
);
export const LedgerTd = ({ mono, className, ...p }: TdHTMLAttributes<HTMLTableCellElement> & { mono?: boolean }) => (
  <td className={cx("px-3 py-3 align-middle first:pl-5 last:pr-5", mono && "font-mono whitespace-nowrap text-muted", className)} {...p} />
);
