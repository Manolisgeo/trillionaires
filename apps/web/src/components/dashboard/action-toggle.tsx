"use client";

import { useTransition } from "react";
import { toggleActionItemAction } from "@/actions/items";

export function ActionToggle({ id, completed }: { id: string; completed: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleActionItemAction(id, !completed))}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-line bg-white print:hidden"
      aria-pressed={completed}
      aria-label={completed ? "Reopen action" : "Mark action done"}
    >
      {completed ? <span className="block text-[10px] leading-4 text-accent">✓</span> : null}
    </button>
  );
}
