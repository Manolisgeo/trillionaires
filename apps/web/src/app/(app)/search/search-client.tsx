"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";

type Result = {
  semantic: Array<{ conversationId: string; score: number; snippet: string; title?: string }>;
  keywordHits: Array<{
    id: string;
    text: string;
    transcript: { conversationId: string; conversation?: { title: string } };
  }>;
};

const examples = [
  "100k requests per second",
  "consistency model",
  "postmortem",
  "replica lag",
];

export function SearchClient() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const run = useCallback(async (value: string) => {
    const q = value.trim();
    if (!q) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error("Search failed");
      setResult(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (initial.trim()) void run(initial);
  }, [initial, run]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("q", query.trim());
    window.history.replaceState(null, "", url.pathname + url.search);
    await run(query);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Search"
        description="Conversation-level semantic and keyword search. Ask about claims, objections, or people — results stay inside this organization."
      />
      <form onSubmit={onSubmit} className="mt-8 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Which candidates mentioned 100k requests per second?"
        />
        <Button type="submit" disabled={pending || !query.trim()}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      {!result ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-ink/40 hover:text-ink"
              onClick={() => {
                setQuery(example);
                const url = new URL(window.location.href);
                url.searchParams.set("q", example);
                window.history.replaceState(null, "", url.pathname + url.search);
                void run(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-10 space-y-8">
          <section>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Conversations
            </h2>
            <div className="mt-4 space-y-4">
              {result.semantic.length === 0 ? (
                <p className="text-sm text-muted">No conversation matches. Keyword hits may still appear below.</p>
              ) : (
                result.semantic.map((hit) => (
                  <Link
                    key={`${hit.conversationId}-${hit.snippet.slice(0, 24)}`}
                    href={`/conversations/${hit.conversationId}`}
                    className="block rounded-xl border border-line bg-white p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-medium">{hit.title ?? "Conversation"}</div>
                      <div className="text-xs text-muted">score {hit.score.toFixed(2)}</div>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted">{hit.snippet}</p>
                  </Link>
                ))
              )}
            </div>
          </section>
          <section>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Transcript</h2>
            <div className="mt-4 space-y-3">
              {result.keywordHits.length === 0 ? (
                <p className="text-sm text-muted">No keyword matches.</p>
              ) : (
                result.keywordHits.map((hit) => (
                  <Link
                    key={hit.id}
                    href={`/conversations/${hit.transcript.conversationId}`}
                    className="block rounded-xl border border-line bg-white p-4"
                  >
                    <div className="text-xs text-muted">
                      {hit.transcript.conversation?.title ?? "Transcript"}
                    </div>
                    <p className="mt-1 text-sm leading-6">{hit.text}</p>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
