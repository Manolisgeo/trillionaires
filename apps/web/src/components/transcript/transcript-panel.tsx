"use client";

import { useMemo, useState } from "react";
import type { ImportanceCategory } from "@aperture/types";
import { matchesFilter } from "@aperture/conversation";
import { cn } from "@aperture/ui";
import { formatTimestamp } from "@/lib/time";

type Segment = {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
  isFinal: boolean;
  category?: ImportanceCategory | null;
  importanceScore?: number | null;
};

export function TranscriptPanel({
  segments,
  onSeek,
  activeTime,
}: {
  segments: Segment[];
  onSeek?: (seconds: number) => void;
  activeTime?: number | null;
}) {
  const [filter, setFilter] = useState("EVERYTHING");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return segments.filter((segment) => {
      if (!matchesFilter(segment.category ?? undefined, filter)) return false;
      if (!query.trim()) return true;
      return segment.text.toLowerCase().includes(query.toLowerCase());
    });
  }, [segments, filter, query]);

  const filters = [
    "EVERYTHING",
    "IMPORTANT",
    "DECISIONS",
    "ACTIONS",
    "QUESTIONS",
    "CONCERNS",
    "CONTRADICTIONS",
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              filter === item ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink/40",
            )}
          >
            {item.toLowerCase()}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript"
        className="mb-6 h-10 w-full max-w-md rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-ink"
      />
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No segments match this filter.</p>
      ) : (
        <div className="space-y-1">
          {visible.map((segment) => {
            const active =
              activeTime != null && Math.abs(segment.startTime - activeTime) < 1.5;
            return (
              <button
                key={segment.id}
                id={`t-${Math.floor(segment.startTime)}`}
                type="button"
                className={cn(
                  "block w-full rounded-lg px-3 py-3 text-left transition-colors",
                  active ? "bg-ink/[0.04]" : "hover:bg-black/[0.02]",
                )}
                onClick={() => onSeek?.(segment.startTime)}
              >
                <div className="flex flex-wrap items-baseline gap-3 text-xs text-muted">
                  <span className="font-mono">{formatTimestamp(segment.startTime)}</span>
                  <span>{segment.speakerName}</span>
                  {segment.category ? (
                    <span className="uppercase tracking-wide">
                      {segment.category.replaceAll("_", " ").toLowerCase()}
                    </span>
                  ) : null}
                </div>
                <p className={cn("mt-1 text-sm leading-relaxed", !segment.isFinal && "opacity-50")}>
                  {segment.text}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
