"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface TabDef {
  id: string;
  label: ReactNode;
}

const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** Hard-swap folder tabs. Exactly one document owns the desk; tabs never tile. */
export function FolderTabs({
  tabs,
  value,
  onChange,
  idPrefix,
  label = "Documents on the desk",
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  idPrefix: string;
  label?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: KeyboardEvent, i: number) {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const t = tabs[n];
    onChange(t.id);
    refs.current[t.id]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 pl-3">
      {tabs.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={tabId(idPrefix, t.id)}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={panelId(idPrefix, t.id)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              "relative min-h-11 cursor-pointer rounded-t-md border border-rule px-4 text-sm",
              on ? "top-px border-b-card bg-card font-semibold text-ink" : "bg-tab text-ink-2 hover:bg-white",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, id, active, children, className }: { idPrefix: string; id: string; active: boolean; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} hidden={!active} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
