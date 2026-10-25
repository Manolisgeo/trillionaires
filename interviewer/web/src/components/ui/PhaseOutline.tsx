import type { ReactNode } from "react";
import { cx } from "./cx";

export interface OutlineSub {
  id: string;
  label: ReactNode;
  current?: boolean;
}
export interface OutlineItem {
  id: string;
  numeral: string;
  label: string;
  state: "done" | "current" | "upcoming";
  /** Right column: "done", "06:42 / 10:00", "8 min". */
  readout?: string;
  subs?: OutlineSub[];
}

/** Finding-aid list of interview phases: done muted, current bold with its questions, upcoming with minutes. */
export function PhaseOutline({ items, label = "Interview phases" }: { items: OutlineItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2 text-sm">
      <div className="font-mono text-xs tracking-[0.12em] text-muted">FINDING AID</div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((it) => (
          <li key={it.id} aria-current={it.state === "current" ? "step" : undefined} className="flex flex-col gap-2">
            <div className={cx("flex justify-between gap-3", it.state === "done" && "text-muted", it.state === "current" && "font-bold")}>
              <span>
                {it.numeral} · {it.label}
              </span>
              {it.readout ? <span className={cx("font-mono tabular-nums", it.state === "current" ? "font-normal" : "text-muted")}>{it.readout}</span> : null}
            </div>
            {it.state === "current" && it.subs?.length ? (
              <ul className="m-0 ml-1 flex list-none flex-col gap-1 border-l border-rule py-0 pr-0 pl-4">
                {it.subs.map((s) => (
                  <li key={s.id} className={cx(s.current ? "-ml-2 bg-ink px-2 py-0.5 text-white" : "text-muted")}>
                    {s.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
