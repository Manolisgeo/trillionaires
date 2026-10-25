"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@kimma/ui";
import type { ImportanceCategory } from "@kimma/types";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { ConversationTimeline } from "@/components/conversation/timeline";
import { ReportView } from "@/components/report/report-view";
import { AskTranscript, ScorecardPanel, type ScoreCriterion } from "@/components/conversation/scorecard-panel";
import { EmptyState } from "@/components/shell/empty-state";
import { EvidenceBoard, type EvidenceClaim } from "@/components/intelligence/evidence-board";

type Tab = "overview" | "transcript" | "timeline" | "evidence" | "scorecard" | "report";

export function ConversationWorkspace({
  purpose,
  objectives,
  participants,
  segments,
  insights,
  actionItems = [],
  report,
  scorecard,
  claims = [],
  initialTab = "overview",
}: {
  purpose: string;
  objectives: Array<{ id: string; title: string; status: string }>;
  participants: Array<{ id: string; displayName: string; role: string; isAgent: boolean }>;
  segments: Array<{
    id: string;
    speakerName: string;
    text: string;
    startTime: number;
    isFinal: boolean;
    category?: ImportanceCategory | null;
    importanceScore?: number | null;
  }>;
  insights: Array<{
    id: string;
    title: string;
    body: string;
    kind: string;
    category: string;
    timestampSeconds: number | null;
  }>;
  actionItems?: Array<{
    id: string;
    text: string;
    owner: string | null;
    completed: boolean;
  }>;
  report: {
    summary: string | null;
    sections: Array<{ id: string; key: string; title: string; body: string; kind?: string | null }>;
  } | null;
  claims?: EvidenceClaim[];
  scorecard?: {
    conversationId: string;
    criteria: ScoreCriterion[];
    speakers: Array<{ name: string; seconds: number; share: number; turns: number }>;
    questions: number;
    hits: Array<{ id: string; trackerName: string; startTime: number; speakerName: string; excerpt: string }>;
  } | null;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [seek, setSeek] = useState<number | null>(null);

  useEffect(() => {
    if (seek == null) return;
    const node = document.getElementById(`t-${Math.floor(seek)}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [seek, tab]);

  const covered = objectives.filter((o) => o.status === "COVERED").length;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "transcript", label: "Transcript" },
    { id: "timeline", label: "Timeline" },
    { id: "evidence", label: "Evidence" },
    { id: "scorecard", label: "Scorecard" },
    { id: "report", label: "Report" },
  ];

  const timelineEvents = useMemo(
    () => [
      { id: "start", timestampSeconds: 0, label: "Conversation opened", category: "BACKGROUND" },
      ...insights.map((insight) => ({
        id: insight.id,
        timestampSeconds: insight.timestampSeconds ?? 0,
        label: insight.title,
        category: insight.category,
      })),
    ],
    [insights],
  );

  function jump(seconds: number) {
    setSeek(seconds);
    if (tab !== "transcript") setTab("transcript");
  }

  return (
    <div className="mt-10">
      <div className="print:hidden flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b px-3 py-2 text-sm transition-colors",
              tab === item.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Purpose
            </h2>
            <p className="mt-3 text-sm leading-7">{purpose}</p>
            <h2 className="mt-10 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Objectives · {covered}/{objectives.length} covered
            </h2>
            <ul className="mt-4 space-y-3">
              {objectives.map((objective) => (
                <li key={objective.id} className="flex items-center justify-between gap-4 text-sm">
                  <span>{objective.title}</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    {objective.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Participants
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {participants.map((p) => (
                <li key={p.id}>
                  {p.displayName}
                  {p.isAgent ? " · AI" : ""} · {p.role.toLowerCase()}
                </li>
              ))}
            </ul>
            <h2 className="mt-10 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Evidence labels
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              FACT is transcript-supported. INFERENCE is interpretation. UNCERTAINTY is weak or
              conflicting evidence. Kimma never makes the hiring, purchasing, or research
              decision.
            </p>
            {insights.length > 0 ? (
              <>
                <h2 className="mt-10 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  What matters
                </h2>
                <ul className="mt-4 space-y-3">
                  {insights.slice(0, 6).map((insight) => (
                    <li key={insight.id} className="text-sm">
                      <button type="button" className="text-left hover:underline" onClick={() => jump(insight.timestampSeconds ?? 0)}>
                        <span className="text-[11px] uppercase tracking-wide text-muted">
                          {insight.kind}
                        </span>
                        <div>{insight.title}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {actionItems.length > 0 ? (
              <>
                <h2 className="mt-10 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  Actions
                </h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {actionItems.map((item) => (
                    <li key={item.id} className={item.completed ? "text-muted line-through" : ""}>
                      {item.text}
                      {item.owner ? <span className="text-xs text-muted"> · {item.owner}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "transcript" ? (
        <div className="mt-8">
          {segments.length === 0 ? (
            <EmptyState
              title="No transcript yet"
              description="Start the call. Captions stream here live, then persist for search and the report."
            />
          ) : (
            <TranscriptPanel segments={segments} onSeek={jump} activeTime={seek} />
          )}
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="mt-8">
          <ConversationTimeline events={timelineEvents} onSeek={jump} />
        </div>
      ) : null}

      {tab === "scorecard" ? (
        <div className="mt-8 space-y-12">
          {scorecard ? (
            <>
              <ScorecardPanel
                criteria={scorecard.criteria}
                speakers={scorecard.speakers}
                questions={scorecard.questions}
                hits={scorecard.hits}
                onSeek={jump}
              />
              <AskTranscript conversationId={scorecard.conversationId} />
            </>
          ) : (
            <EmptyState
              title="Scorecard not ready"
              description="Objectives become the rubric. After the transcript exists, each criterion is drafted against a quote."
            />
          )}
        </div>
      ) : null}

      {tab === "evidence" ? (
        <div className="mt-8">
          <EvidenceBoard claims={claims} onSeek={jump} />
        </div>
      ) : null}

      {tab === "report" ? (
        <div className="mt-8 space-y-10">
          <EvidenceBoard claims={claims} onSeek={jump} />
          {report ? (
            <ReportView summary={report.summary} sections={report.sections} onSeek={jump} />
          ) : (
            <EmptyState
              title="Report not ready"
              description="After the conversation ends, analysis runs in the background. This tab will fill with a structured, evidence-labeled report."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
