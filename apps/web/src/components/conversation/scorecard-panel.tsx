"use client";

import { useState } from "react";
import { rateCriterionAction } from "@/actions/scorecard";
import { formatTimestamp } from "@/lib/time";
import type { ScoreQuote } from "@/lib/quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ScoreCriterion = {
  id: string;
  title: string;
  description: string;
  weight: number;
  strongAnchor: string;
  weakAnchor: string;
  rating: {
    score: number | null;
    rationale: string;
    evidenceKind: string;
    source: string;
    confidence: string;
    observation: string;
    interpretation: string;
    quotes: ScoreQuote[];
    counterQuotes: ScoreQuote[];
  } | null;
};

const SCALE = [
  { score: 1, label: "Thin" },
  { score: 2, label: "Partial" },
  { score: 3, label: "Evidenced" },
  { score: 4, label: "Exceptional" },
];

export function ScorecardPanel({
  criteria,
  speakers,
  questions,
  hits,
  onSeek,
}: {
  criteria: ScoreCriterion[];
  speakers: Array<{ name: string; seconds: number; share: number; turns: number }>;
  questions: number;
  hits: Array<{ id: string; trackerName: string; startTime: number; speakerName: string; excerpt: string }>;
  onSeek?: (seconds: number) => void;
}) {
  return (
    <div className="space-y-12">
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Each criterion shows the quote, any conflicting quote, and a confidence label. Kimma does
        not turn that into a 1–4 score. A person does, and Kimma does not make the hiring,
        purchasing, or research decision.
      </p>

      <section className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          {criteria.length === 0 ? (
            <p className="text-sm text-muted">Add objectives when you create the conversation. They become the rubric.</p>
          ) : (
            criteria.map((criterion) => (
              <CriterionCard key={criterion.id} criterion={criterion} onSeek={onSeek} />
            ))
          )}
        </div>
        <aside className="space-y-8">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Talk time</h2>
            <ul className="mt-4 space-y-3">
              {speakers.map((speaker) => (
                <li key={speaker.name}>
                  <div className="flex justify-between text-xs">
                    <span>{speaker.name}</span>
                    <span className="tabular-nums text-muted">
                      {Math.round(speaker.share * 100)}% · {speaker.turns} turns
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-ink" style={{ width: `${Math.round(speaker.share * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{questions} questions in the transcript.</p>
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Tracked moments</h2>
            {hits.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No tracker phrases in this transcript yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {hits.slice(0, 8).map((hit) => (
                  <li key={hit.id}>
                    <button type="button" className="text-left" onClick={() => onSeek?.(hit.startTime)}>
                      <div className="text-[11px] uppercase tracking-wide text-muted">
                        {hit.trackerName} · {formatTimestamp(hit.startTime)}
                      </div>
                      <p className="mt-1 text-sm leading-6">{hit.excerpt}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function QuoteList({
  title,
  quotes,
  onSeek,
}: {
  title: string;
  quotes: ScoreQuote[];
  onSeek?: (seconds: number) => void;
}) {
  if (quotes.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{title}</div>
      <ul className="mt-2 space-y-3">
        {quotes.map((quote) => (
          <li key={`${quote.startTime}-${quote.text.slice(0, 24)}`}>
            <button type="button" className="text-left" onClick={() => onSeek?.(quote.startTime)}>
              <span className="font-mono text-xs text-muted">
                {formatTimestamp(quote.startTime)} · {quote.speakerName}
              </span>
              <p className="mt-1 text-sm leading-6">“{quote.text}”</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CriterionCard({
  criterion,
  onSeek,
}: {
  criterion: ScoreCriterion;
  onSeek?: (seconds: number) => void;
}) {
  const rating = criterion.rating;
  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{criterion.title}</h3>
        <span className="text-[11px] uppercase tracking-wide text-muted">
          weight {criterion.weight.toFixed(2)} · {rating?.source === "HUMAN" ? "reviewed" : "draft"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{criterion.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rating?.confidence ? <Badge>{rating.confidence}</Badge> : null}
        {rating?.evidenceKind ? <Badge>{rating.evidenceKind}</Badge> : null}
        <Badge>{rating?.source === "HUMAN" && rating.score ? `Human ${rating.score}/4` : "No automatic score"}</Badge>
      </div>
      {rating?.interpretation ? <p className="mt-3 text-sm leading-6">{rating.interpretation}</p> : null}
      {rating?.rationale && rating.rationale !== rating.interpretation ? (
        <p className="mt-2 text-sm leading-6 text-muted">{rating.rationale}</p>
      ) : null}
      <QuoteList title="Evidence" quotes={rating?.quotes ?? []} onSeek={onSeek} />
      <QuoteList title="Counterevidence" quotes={rating?.counterQuotes ?? []} onSeek={onSeek} />
      <div className="mt-4 text-xs leading-5 text-muted">
        <div>Strong: {criterion.strongAnchor}</div>
        <div>Weak: {criterion.weakAnchor}</div>
      </div>
      <form action={rateCriterionAction} className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted">Human assessment</span>
        <input type="hidden" name="criterionId" value={criterion.id} />
        {SCALE.map((item) => (
          <Button
            key={item.score}
            name="score"
            value={String(item.score)}
            type="submit"
            size="sm"
            variant={rating?.score === item.score && rating.source === "HUMAN" ? "primary" : "secondary"}
          >
            {item.score} {item.label}
          </Button>
        ))}
      </form>
    </article>
  );
}

export function AskTranscript({ conversationId }: { conversationId: string }) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<string>();
  const [quotes, setQuotes] = useState<ScoreQuote[]>([]);
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not answer");
      setAnswer(data.answer);
      setQuotes(data.quotes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        Ask this transcript
      </h2>
      <p className="mt-2 text-sm text-muted">
        Answers are quotes from this conversation. If the transcript does not say it, Kimma says so.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What metric did they cite?"
          className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-ink"
        />
        <Button type="submit" disabled={pending || question.trim().length < 2}>
          {pending ? "Looking…" : "Ask"}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {answer ? <p className="mt-4 text-sm leading-6">{answer}</p> : null}
      <ul className="mt-3 space-y-3">
        {quotes.map((quote) => (
          <li key={`${quote.startTime}-${quote.text.slice(0, 16)}`} className="text-sm leading-6">
            <span className="font-mono text-xs text-muted">
              {formatTimestamp(quote.startTime)} · {quote.speakerName}
            </span>
            <div>“{quote.text}”</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
