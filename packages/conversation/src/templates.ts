import type { ConversationType, Question } from "@kimma/types";

export interface ConversationTemplateDefinition {
  type: ConversationType;
  name: string;
  description: string;
  purpose: string;
  objectives: Array<{ title: string; description: string; importance: number }>;
  questions: Array<
    Omit<Question, "id" | "status"> & {
      key: string;
    }
  >;
}

export const builtinTemplates: ConversationTemplateDefinition[] = [
  {
    type: "INTERVIEW",
    name: "Backend engineering screen",
    description: "Evaluate backend engineering ability from evidence, not a script.",
    purpose: "Evaluate backend engineering ability for a production role.",
    objectives: [
      {
        title: "Backend engineering ability",
        description: "Can they design, operate, and debug backend systems?",
        importance: 0.95,
      },
      {
        title: "Production ownership",
        description: "Have they owned systems under real load and failure?",
        importance: 0.85,
      },
      {
        title: "Communication",
        description: "Can they explain tradeoffs clearly?",
        importance: 0.7,
      },
    ],
    questions: [
      {
        key: "systems",
        prompt: "Tell me about a backend system you designed and what tradeoffs you made.",
        objectiveId: "Backend engineering ability",
        expectedEvidence: ["designed", "tradeoff", "service"],
        importance: 0.9,
        difficulty: 0.5,
        prerequisites: [],
        followUpIds: ["scale", "failure"],
      },
      {
        key: "scale",
        prompt: "What load did it handle, and how did you know the limits?",
        objectiveId: "Backend engineering ability",
        expectedEvidence: ["requests", "latency", "scale"],
        importance: 0.8,
        difficulty: 0.6,
        prerequisites: ["systems"],
        followUpIds: [],
      },
      {
        key: "failure",
        prompt: "Walk me through a production failure you were involved in.",
        objectiveId: "Production ownership",
        expectedEvidence: ["incident", "failure", "recovery"],
        importance: 0.88,
        difficulty: 0.55,
        prerequisites: [],
        followUpIds: [],
      },
    ],
  },
  {
    type: "SALES",
    name: "Discovery",
    description: "Uncover pain, process, and buying signals.",
    purpose: "Understand whether there is a real problem, owner, and path to a decision.",
    objectives: [
      { title: "Pain", description: "What is broken today?", importance: 0.9 },
      { title: "Process", description: "How do they buy and evaluate?", importance: 0.75 },
      { title: "Urgency", description: "Why now?", importance: 0.7 },
    ],
    questions: [
      {
        key: "pain",
        prompt: "What prompted you to take this conversation?",
        objectiveId: "Pain",
        expectedEvidence: ["problem", "pain", "today"],
        importance: 0.9,
        difficulty: 0.3,
        prerequisites: [],
        followUpIds: ["impact"],
      },
      {
        key: "impact",
        prompt: "What does that cost you if nothing changes?",
        objectiveId: "Pain",
        expectedEvidence: ["cost", "time", "revenue"],
        importance: 0.8,
        difficulty: 0.4,
        prerequisites: ["pain"],
        followUpIds: [],
      },
    ],
  },
  {
    type: "RESEARCH",
    name: "Customer research",
    description: "Test hypotheses and capture language.",
    purpose: "Learn how this person currently solves the problem and where it fails.",
    objectives: [
      { title: "Current workflow", description: "How they work today", importance: 0.85 },
      { title: "Jobs to be done", description: "What they are actually hiring a product to do", importance: 0.8 },
    ],
    questions: [
      {
        key: "today",
        prompt: "Walk me through the last time you did this — step by step.",
        objectiveId: "Current workflow",
        expectedEvidence: ["first", "then", "tool"],
        importance: 0.85,
        difficulty: 0.3,
        prerequisites: [],
        followUpIds: [],
      },
    ],
  },
  {
    type: "EXPERT_INTERVIEW",
    name: "Expert interview",
    description: "Investigate claims and map expertise.",
    purpose: "Understand this expert's claims, evidence, and remaining uncertainty.",
    objectives: [
      { title: "Claims", description: "What they believe is true", importance: 0.9 },
      { title: "Evidence", description: "What they are basing that on", importance: 0.85 },
    ],
    questions: [
      {
        key: "claim",
        prompt: "What is the most important claim you would make in this area?",
        objectiveId: "Claims",
        expectedEvidence: ["because", "evidence", "data"],
        importance: 0.9,
        difficulty: 0.4,
        prerequisites: [],
        followUpIds: ["counter"],
      },
    ],
  },
  {
    type: "MEETING",
    name: "Working meeting",
    description: "Decisions, owners, follow-ups.",
    purpose: "Leave with decisions, owners, and open questions.",
    objectives: [
      { title: "Decisions", description: "What was decided", importance: 0.95 },
      { title: "Owners", description: "Who does what next", importance: 0.85 },
    ],
    questions: [
      {
        key: "decision",
        prompt: "What decision do we need to make in this conversation?",
        objectiveId: "Decisions",
        expectedEvidence: ["decide", "agree", "will"],
        importance: 0.9,
        difficulty: 0.2,
        prerequisites: [],
        followUpIds: [],
      },
    ],
  },
];

export function templateByType(type: ConversationType): ConversationTemplateDefinition {
  return builtinTemplates.find((template) => template.type === type) ?? builtinTemplates[0]!;
}
