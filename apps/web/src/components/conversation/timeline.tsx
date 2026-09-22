"use client";

import { formatTimestamp } from "@/lib/time";

export function ConversationTimeline({
  events,
  onSeek,
}: {
  events: Array<{
    id: string;
    timestampSeconds: number;
    label: string;
    category?: string;
  }>;
  onSeek?: (seconds: number) => void;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">Timeline events appear after the conversation.</p>;
  }

  return (
    <ol className="space-y-5 border-l border-line pl-6">
      {events.map((event) => (
        <li key={event.id} className="-ml-[25px] flex gap-4">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-ink bg-paper" />
          <button type="button" className="text-left" onClick={() => onSeek?.(event.timestampSeconds)}>
            <div className="font-mono text-xs text-muted">{formatTimestamp(event.timestampSeconds)}</div>
            <div className="mt-0.5 text-sm">{event.label}</div>
            {event.category ? (
              <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
                {event.category.replaceAll("_", " ").toLowerCase()}
              </div>
            ) : null}
          </button>
        </li>
      ))}
    </ol>
  );
}
