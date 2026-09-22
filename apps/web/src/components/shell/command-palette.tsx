"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const destinations = [
  { href: "/", label: "Dashboard", hint: "Overview" },
  { href: "/conversations", label: "Conversations", hint: "All conversations" },
  { href: "/conversations/new", label: "New conversation", hint: "Create" },
  { href: "/reports", label: "Reports", hint: "Evidence" },
  { href: "/signals", label: "Signals", hint: "Trackers" },
  { href: "/people", label: "People", hint: "Participants" },
  { href: "/templates", label: "Templates", hint: "Starting points" },
  { href: "/search", label: "Search", hint: "Ask the workspace" },
  { href: "/settings", label: "Settings", hint: "Org controls" },
];

export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = destinations.filter((item) =>
      !q ? true : `${item.label} ${item.hint}`.toLowerCase().includes(q),
    );
    if (q.length >= 2) {
      nav.unshift({
        href: `/search?q=${encodeURIComponent(query.trim())}`,
        label: `Search “${query.trim()}”`,
        hint: "Evidence and transcript",
      });
    }
    return nav;
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else {
          setQuery("");
          setActive(0);
          dialog.current?.showModal();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function go(href: string) {
    dialog.current?.close();
    router.push(href);
  }

  return (
    <dialog
      ref={dialog}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-0 shadow-2xl backdrop:bg-ink/40"
      onClose={() => setQuery("")}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const item = items[active];
          if (item) go(item.href);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((n) => Math.min(items.length - 1, n + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((n) => Math.max(0, n - 1));
            }
          }}
          placeholder="Go to a page or search evidence…"
          className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none"
          autoComplete="off"
        />
      </form>
      <ul className="max-h-80 overflow-auto py-2">
        {items.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted">Nothing matches.</li>
        ) : (
          items.map((item, index) => (
            <li key={item.href + item.label}>
              <button
                type="button"
                onClick={() => go(item.href)}
                className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left text-sm ${
                  index === active ? "bg-ink text-paper" : "hover:bg-black/[0.04]"
                }`}
              >
                <span>{item.label}</span>
                <span className={index === active ? "text-paper/60" : "text-muted"}>{item.hint}</span>
              </button>
            </li>
          ))
        )}
      </ul>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
        ⌘K · evidence stays inside this organization
      </p>
    </dialog>
  );
}
