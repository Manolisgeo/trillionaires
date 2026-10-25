"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/** Copies `path` (resolved against the current origin) or `text`. */
export function CopyButton({ path, text, label = "Copy link" }: { path?: string; text?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    const value = text ?? `${window.location.origin}${path ?? ""}`;
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }
  return (
    <span className="inline-flex items-center gap-3">
      <Button variant="secondary" onClick={copy}>
        {label}
      </Button>
      <span role="status" className="font-mono text-[13px] text-ink-2">
        {state === "copied" ? "Copied" : state === "failed" ? "Select the link and copy it by hand" : ""}
      </span>
    </span>
  );
}

/** Link text that resolves against the current origin after mount (no hydration mismatch). */
export function OriginLink({ path }: { path: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <a href={path} className="break-all font-mono text-sm">
      {origin}
      {path}
    </a>
  );
}
