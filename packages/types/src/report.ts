import type { ClaimKind, ImportanceCategory } from "./conversation";

export interface ReportSection {
  key: string;
  title: string;
  body: string;
  kind?: ClaimKind;
  order: number;
}

export interface ReportActionItem {
  text: string;
  owner?: string;
  dueDate?: string;
  sourceTimestampSeconds?: number;
}

export interface ReportEvidence {
  claim: string;
  kind: ClaimKind;
  excerpt: string;
  timestampSeconds: number;
  segmentId?: string;
}

export interface ReportTopic {
  title: string;
  importance: number;
  summary: string;
}

export interface StructuredReport {
  executiveSummary: string;
  keyTakeaways: string[];
  importantMoments: Array<{
    label: string;
    timestampSeconds: number;
    summary: string;
    category: ImportanceCategory;
  }>;
  decisions: string[];
  actionItems: ReportActionItem[];
  questionsRaised: string[];
  contradictions: Array<{
    summary: string;
    statementA: string;
    statementB: string;
    timestampSeconds: number;
  }>;
  evidence: ReportEvidence[];
  topics: ReportTopic[];
  detailedAnalysis: string;
  objectiveEvaluations: Array<{
    objectiveId: string;
    title: string;
    status: "COVERED" | "PARTIAL" | "UNCOVERED";
    assessment: string;
    kind: ClaimKind;
  }>;
}

export const REPORT_SECTION_ORDER = [
  "executive_summary",
  "key_takeaways",
  "important_moments",
  "decisions",
  "action_items",
  "questions_raised",
  "contradictions",
  "evidence",
  "topics",
  "detailed_analysis",
  "full_transcript",
] as const;
