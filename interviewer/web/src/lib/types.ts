export type Id = string; // short base64url id

export type Phase = "intro" | "behavioral" | "background" | "technical" | "close";
export const PHASES: Phase[] = ["intro", "behavioral", "background", "technical", "close"];

export interface Anchor { weak: string; ok: string; strong: string }           // BARS
export interface Competency { id: Id; name: string; description: string; weight: number; anchors: Anchor }
export interface Skill { id: Id; name: string; weight: number; evidenceHints: string[] }
export interface CoreQuestion { id: Id; competencyId: Id; text: string; followUps: string[] } // STAR behavioral
export interface TechTopic { id: Id; name: string; difficulty: "junior" | "mid" | "senior"; probes: string[] }
export interface BoardProblem { id: Id; title: string; prompt: string; goodAnswerLooksLike: string; constraintChanges: string[] }

export interface RoleProfile {
  summary: string; level: string;
  mustHave: Skill[]; niceToHave: Skill[];
  competencies: Competency[];          // 4–6
  coreQuestions: CoreQuestion[];       // 3–5, same for every candidate
  technicalTopics: TechTopic[];
  problems: BoardProblem[];            // 1–3 whiteboard problems (no code execution)
  guardrailNotes: string[];            // questions the agent must never ask (protected characteristics etc.)
}
export interface Role {
  id: Id; title: string; company: string; jdText: string;
  status: "drafting" | "draft" | "approved"; profile: RoleProfile | null;
  createdAt: string; demoData?: boolean; draftError?: string;
}

export type SourceKind = "cv" | "linkedin" | "github" | "web";
export interface Source { kind: SourceKind; quote: string; page?: number; url?: string }
export interface Claim { id: Id; text: string; skillIds: Id[]; source: Source; removedByCandidate?: boolean }
export interface TimelineItem { org: string; title: string; start: string; end: string | null; claimIds: Id[] }
export interface Flag { id: Id; kind: "gap" | "inconsistency" | "unverified" | "other"; text: string; claimIds: Id[] }
export interface GithubSummary { handle: string; repos: { name: string; url: string; description: string | null; language: string | null; stars: number; pushedAt: string }[]; topLanguages: string[] }
export interface CandidateProfile {
  headline: string; claims: Claim[]; timeline: TimelineItem[]; flags: Flag[];
  github: GithubSummary | null; webFindings: { url: string; title: string; summary: string }[];
}
export interface Candidate {
  id: Id; roleId: Id; name: string; email: string;
  cvPath: string; linkedinPdfPath: string | null; githubHandle: string | null; links: string[];
  consentAt: string;
  research: "pending" | "running" | "done" | "failed"; researchError?: string;
  profile: CandidateProfile | null; reviewedAt: string | null;   // candidate confirmed the gathered summary
  createdAt: string; demoData?: boolean;
}

export type BriefBucket = "matched" | "unverified" | "gap" | "flag";
export interface BriefItem { bucket: BriefBucket; skillOrCompetencyId: Id | null; claimId: Id | null; note: string }
export interface Brief { items: BriefItem[] }
export interface PlannedQuestion {
  id: Id; kind: "core" | "probe"; text: string; competencyId: Id | null; skillId: Id | null;
  source: Source | null;               // the CV line / repo this probe is about → agent highlights it
  followUps: string[];
}
export interface PhasePlan { phase: Phase; minutes: number; objectives: string[]; questions: PlannedQuestion[]; problemId?: Id }
export interface Plan { phases: PhasePlan[] }

export interface Segment { id: Id; speaker: "agent" | "candidate"; text: string; start: number; end: number } // seconds since interview.startedAt
export interface DeskEvent { seq: number; t: number; type: string; payload: unknown }
export interface EvidenceNote { id: Id; t: number; competencyId: Id | null; skillId: Id | null; note: string; segmentId: Id | null }
export interface IntegritySignal { t: number; kind: "tab_hidden" | "paste" | "rejoin" | "long_silence"; detail?: string } // metadata, never a verdict

export interface CriterionScore {
  criterionId: Id; kind: "competency" | "skill"; name: string;
  rating: 1 | 2 | 3 | null;            // null = insufficient evidence; 4 is human-only
  rationale: string;
  evidence: { quote: string; segmentId: Id; t: number }[]; // quotes MUST be verbatim substrings of transcript segments
}
export interface Report {
  summary: string; recommendation: "advance" | "human_review"; recommendationReason: string;
  criteria: CriterionScore[]; strengths: string[]; concerns: string[]; openQuestions: string[];
  integrityNotes: string[]; scorerModel: string; createdAt: string; demoData?: boolean;
}

export interface Interview {
  id: Id; roleId: Id; candidateId: Id; mode: "room" | "meet";
  meetUrl: string | null; recallBotId: string | null;
  status: "scheduled" | "live" | "processing" | "done" | "failed";
  brief: Brief; plan: Plan;
  startedAt: string | null; endedAt: string | null;
  recording: { url: string; offsetSec: number } | null; // offsetSec = recording start minus startedAt
  transcript: Segment[]; events: DeskEvent[]; evidence: EvidenceNote[]; integrity: IntegritySignal[];
  board: { summary: string; padText: string; pngPath: string | null; updatedAt: string } | null;
  report: Report | null; createdAt: string;
}
