// Labeled demo fixtures used when ANTHROPIC_API_KEY is missing. Everything here is invented; never present as real analysis.
import type {
  Brief, Candidate, CandidateProfile, Claim, Interview, Plan, Report, Role, RoleProfile,
} from "../types";
import { assemblePlan } from "./plan";
import { normalizeWs, verifyAndFinalizeCriteria } from "../scoring";

export const DEMO_LABEL = "[Demo data]";

export function fixtureRoleProfile(i: { title: string; company: string }): RoleProfile {
  return {
    summary: `${DEMO_LABEL} ${i.title} at ${i.company}: owns services end to end, works across product and design, and raises the technical bar of the team.`,
    level: "senior",
    mustHave: [
      { id: "s1", name: "Backend service design", weight: 5, evidenceHints: ["APIs they designed", "scaling or reliability tradeoffs"] },
      { id: "s2", name: "TypeScript or Python in production", weight: 4, evidenceHints: ["production codebases", "testing and code review habits"] },
      { id: "s3", name: "Data modeling and SQL", weight: 3, evidenceHints: ["schema decisions", "query performance work"] },
    ],
    niceToHave: [{ id: "s4", name: "Real-time or streaming systems", weight: 2, evidenceHints: ["websockets, queues, media pipelines"] }],
    competencies: [
      {
        id: "c1", name: "Problem solving", weight: 5, description: "Breaks ambiguous problems into testable steps and weighs tradeoffs.",
        anchors: {
          weak: "Jumps to a solution without clarifying the problem or naming tradeoffs.",
          ok: "Clarifies constraints, proposes a workable approach and names at least one tradeoff.",
          strong: "Structures the problem, compares options with evidence, and anticipates failure modes unprompted.",
        },
      },
      {
        id: "c2", name: "Ownership and initiative", weight: 4, description: "Drives work to a result without being asked.",
        anchors: {
          weak: "Describes team outcomes only; cannot say what they personally did.",
          ok: "Names concrete personal actions and a measurable result.",
          strong: "Identified the problem themselves, drove the fix across teams, and can quantify the impact.",
        },
      },
      {
        id: "c3", name: "Communication", weight: 3, description: "Explains technical ideas clearly and listens.",
        anchors: {
          weak: "Answers are vague or hard to follow; ignores follow-up questions.",
          ok: "Clear answers with some structure; responds to follow-ups.",
          strong: "Concise, structured explanations that adapt to the listener and check understanding.",
        },
      },
      {
        id: "c4", name: "Collaboration", weight: 3, description: "Works through disagreement and shares credit.",
        anchors: {
          weak: "Blames others or avoids describing conflict.",
          ok: "Describes a disagreement and how it was resolved.",
          strong: "Shows empathy for the other view, a deliberate approach, and a lasting improvement in how the team worked.",
        },
      },
    ],
    coreQuestions: [
      { id: "q1", competencyId: "c2", text: "Tell me about a time you took ownership of a problem nobody had asked you to solve.", followUps: ["What specifically did you do?", "What was the result, and how did you measure it?"] },
      { id: "q2", competencyId: "c4", text: "Describe a technical disagreement with a teammate. How did it end?", followUps: ["What was their position?", "What would you do differently?"] },
      { id: "q3", competencyId: "c1", text: "Tell me about the hardest debugging or production incident you handled.", followUps: ["How did you narrow it down?", "What did you change so it would not recur?"] },
    ],
    technicalTopics: [
      { id: "t1", name: "API and service design", difficulty: "senior", probes: ["How would you version a public API?", "Where would you put rate limiting and why?"] },
      { id: "t2", name: "Data modeling", difficulty: "mid", probes: ["How do you decide between normalizing and denormalizing?", "How would you find and fix a slow query?"] },
    ],
    problems: [
      {
        id: "p1", title: "Design a job-interview scheduling service",
        prompt: "Sketch the services, data model and main flows for a system that lets candidates book interview slots with interviewers across time zones.",
        goodAnswerLooksLike: "Clear entities (slot, booking, user), handles double-booking with a uniqueness constraint or transaction, discusses time zones and notifications.",
        constraintChanges: ["Now 10x the traffic at announcement time.", "Interviewers can cancel with 1 hour notice. What changes?"],
      },
    ],
    guardrailNotes: [
      "Never ask about age, gender, race, ethnicity, religion, nationality or citizenship status.",
      "Never ask about marital status, pregnancy, children or family plans.",
      "Never ask about health, disability, or medical history.",
      "Never ask about political views, union membership or sexual orientation.",
    ],
  };
}

export function fixtureCandidateProfile(c: Candidate, role: Role): CandidateProfile {
  const mh = role.profile?.mustHave ?? [];
  const sk = (n: number): string[] => (mh[n] ? [mh[n].id] : []);
  const claims: Claim[] = [
    { id: "cl1", text: "Led a rewrite of the billing API to a typed service layer.", skillIds: sk(0), source: { kind: "cv", quote: "Led rewrite of billing API to a typed service layer", page: 1 } },
    { id: "cl2", text: "Reduced p95 latency of checkout by 40 percent.", skillIds: sk(0), source: { kind: "cv", quote: "Reduced p95 checkout latency by 40%", page: 1 } },
    { id: "cl3", text: "Maintains an open-source queue library.", skillIds: sk(1), source: { kind: "github", quote: "queue-kit: a small job queue for Node", url: "https://github.com/demo/queue-kit" } },
  ];
  return {
    headline: `${DEMO_LABEL} ${c.name}, backend engineer with 6 years of experience`,
    claims,
    timeline: [
      { org: "Northwind Payments", title: "Senior Engineer", start: "2022-03", end: null, claimIds: ["cl1", "cl2"] },
      { org: "Fabrikam", title: "Software Engineer", start: "2018-06", end: "2022-02", claimIds: ["cl3"] },
    ],
    flags: [
      { id: "f1", kind: "unverified", text: "The 40 percent latency claim has no stated baseline or measurement method.", claimIds: ["cl2"] },
      { id: "f2", kind: "gap", text: "No evidence of SQL or schema design work in the CV.", claimIds: [] },
    ],
    github: null,
    webFindings: [],
  };
}

export function fixtureBriefAndPlan(role: Role, cand: Candidate): { brief: Brief; plan: Plan } {
  const profile = role.profile ?? fixtureRoleProfile({ title: role.title, company: role.company });
  const cp = cand.profile ?? fixtureCandidateProfile(cand, role);
  const brief: Brief = { items: [] };
  for (const s of profile.mustHave) {
    const claim = cp.claims.find((c) => c.skillIds.includes(s.id));
    if (!claim) brief.items.push({ bucket: "gap", skillOrCompetencyId: s.id, claimId: null, note: `${DEMO_LABEL} No CV evidence for "${s.name}".` });
    else if (cp.flags.some((f) => f.claimIds.includes(claim.id)))
      brief.items.push({ bucket: "unverified", skillOrCompetencyId: s.id, claimId: claim.id, note: `${DEMO_LABEL} Claimed but unquantified: ${claim.text}` });
    else brief.items.push({ bucket: "matched", skillOrCompetencyId: s.id, claimId: claim.id, note: `${DEMO_LABEL} ${claim.text}` });
  }
  for (const f of cp.flags.filter((x) => x.kind === "inconsistency" || x.kind === "other"))
    brief.items.push({ bucket: "flag", skillOrCompetencyId: null, claimId: f.claimIds[0] ?? null, note: f.text });

  const plan = assemblePlan(profile, {
    probes: [
      ...cp.claims.slice(0, 2).map((c) => ({
        phase: "background" as const, text: `You mention: "${c.source.quote}". What was your part in that, and what was the result?`,
        competencyId: profile.competencies[1]?.id ?? null, skillId: c.skillIds[0] ?? null,
        source: { kind: c.source.kind, quote: c.source.quote, page: c.source.page ?? null, url: c.source.url ?? null }, followUps: ["How did you measure it?"],
      })),
      {
        phase: "behavioral" as const, text: "Looking at your recent role, when did you have to push back on a deadline?",
        competencyId: profile.competencies[0]?.id ?? null, skillId: null, source: null, followUps: ["What did you do?"],
      },
      {
        phase: "technical" as const, text: "How would you design the data model for the system on the board?",
        competencyId: null, skillId: profile.mustHave[2]?.id ?? null, source: null, followUps: ["Where could it break?"],
      },
    ],
    objectives: {
      behavioral: ["Collect STAR evidence on ownership and collaboration"],
      background: ["Verify the headline claims on the CV with concrete detail"],
      technical: ["Assess service and data design on the shared board"],
    },
    problemId: profile.problems[0]?.id ?? null,
  });
  return { brief, plan };
}

const sentences = (text: string): string[] => normalizeWs(text).match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter((x) => x.length >= 24) ?? [];

const STOP = new Set(["the", "and", "with", "that", "this", "for", "from", "into", "about", "their", "they", "them", "what", "when", "your", "have", "been", "were", "will", "than", "then", "work", "works", "experience", "skills", "strong", "ability", "understanding", "knowledge", "production", "systems", "system"]);

/** A scoring term: a regexp over a sentence, with a weight (languages and exact technical terms count double). */
interface Term { re: RegExp; w: number }
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const prefix = (t: string, w = 1): Term => ({ re: new RegExp(`\\b${esc(t)}`, "i"), w });

/** Languages a criterion name can ask for; "go" is matched only in a programming sense ("Go services", "in Go"), never "go to the board". */
const LANGS: { name: string; re: RegExp }[] = [
  { name: "typescript", re: /\btypescript\b/i },
  { name: "javascript", re: /\b(?:javascript|node\.?js)\b/i },
  { name: "python", re: /\bpython\b/i },
  { name: "go", re: /\bgolang\b|\b(?:in|to|with|using|wrote|written in) go\b(?! (?:to|or|ahead|through|over|live|on))|\bgo (?:services?|code|codebase|modules?|routines?|concurrency)\b/i },
  { name: "rust", re: /\brust\b/i },
  { name: "java", re: /\bjava\b/i },
  { name: "kotlin", re: /\bkotlin\b/i },
  { name: "ruby", re: /\b(?:ruby|rails)\b/i },
  { name: "scala", re: /\bscala\b/i },
  { name: "elixir", re: /\belixir\b/i },
  { name: "php", re: /\bphp\b/i },
  { name: "swift", re: /\bswift\b/i },
];
const langInName = (name: string) => LANGS.filter((l) => new RegExp(`\\b${l.name}\\b`, "i").test(name));

const KEYWORDS: Record<string, string[]> = {
  "problem solving": ["reproduc", "replay", "benchmark", "froze", "compar", "constraint", "failure", "measure", "root cause", "rolled back", "partition"],
  "ownership": ["paged", "postmortem", "owned", "nobody", "wrote", "rolled back", "built", "shipped"],
  "communication": ["explain", "agreed", "walk", "postmortem", "document", "wrote the review"],
  "collaboration": ["colleague", "teammate", "team", "agreed", "together", "review", "pair"],
  "service design": ["service", "latency", "migrat", "traffic", "kafka", "api", "idempot", "consumer", "queue", "cutover"],
  "backend": ["service", "latency", "migrat", "traffic", "kafka", "api", "idempot", "consumer", "queue", "cutover"],
  "data model": ["query", "index", "schema", "migration", "query plan", "execution plan", "postgres", "sql", "table", "constraint", "ledger", "partition"],
  "sql": ["query", "index", "schema", "migration", "query plan", "execution plan", "postgres", "sql", "table", "constraint"],
  "real-time": ["stream", "websocket", "kafka", "queue", "consumer lag", "events per second", "latency"],
  "streaming": ["stream", "websocket", "kafka", "queue", "consumer lag", "events per second", "latency"],
};

/** Terms for one criterion: its language (when the name asks for one), else the name's keyword list, else words from name and hints only. */
function termsFor(name: string, hints: string[]): { terms: Term[]; min: number } {
  const langs = langInName(name);
  if (langs.length) return { terms: langs.map((l) => ({ re: l.re, w: 2 })), min: 1 };
  const low = name.toLowerCase();
  const keys = Object.keys(KEYWORDS).filter((k) => low.includes(k));
  if (keys.length) return { terms: [...new Set(keys.flatMap((k) => KEYWORDS[k]))].map((t) => prefix(t)), min: 1 };
  // Unknown criterion: only a sentence that matches two different words of its name and hints counts as relevant.
  const words = [...low.split(/\W+/).filter((w) => w.length > 3), ...hints.join(" ").toLowerCase().split(/\W+/).filter((w) => w.length > 5)].filter((w) => !STOP.has(w));
  return { terms: [...new Set(words.map((w) => w.slice(0, 6)))].map((w) => prefix(w)), min: 2 };
}

const score = (terms: Term[], sentence: string) => terms.reduce((n, t) => n + (t.re.test(sentence) ? t.w : 0), 0);

const gist = (q: string) => {
  const w = q.replace(/[.!?]+$/, "").split(/\s+/);
  return w.length > 16 ? `${w.slice(0, 16).join(" ")}…` : w.join(" ");
};

/**
 * Mock-mode report: no model is called. Quotes are assigned to criteria by keyword relevance to each criterion's own
 * name (languages for language criteria), best pair first, and a quote supports at most one criterion. A criterion
 * with no relevant quote gets rating null (insufficient evidence). Quotes are whole candidate sentences, verified.
 */
export function fixtureReport(interview: Interview, role: Role): Report {
  const profile = role.profile ?? fixtureRoleProfile({ title: role.title, company: role.company });
  const pool = interview.transcript
    .filter((s) => s.speaker === "candidate")
    .flatMap((s) => sentences(s.text).filter((q) => q.split(/\s+/).length >= 8).map((quote) => ({ segmentId: s.id, quote })));
  const rubric = [
    ...profile.competencies.map((c) => ({ id: c.id, name: c.name, ...termsFor(c.name, []) })),
    ...profile.mustHave.map((s) => ({ id: s.id, name: s.name, ...termsFor(s.name, s.evidenceHints) })),
  ];
  const pairs = rubric.flatMap((c, ci) => pool.map((p, pi) => ({ ci, pi, score: score(c.terms, p.quote), min: c.min }))).filter((x) => x.score >= x.min);
  pairs.sort((a, b) => b.score - a.score || a.ci - b.ci || a.pi - b.pi);
  const taken = new Map<number, { pi: number; score: number }>();
  const usedQuotes = new Set<number>();
  for (const x of pairs) {
    if (taken.has(x.ci) || usedQuotes.has(x.pi)) continue;
    taken.set(x.ci, { pi: x.pi, score: x.score });
    usedQuotes.add(x.pi);
  }
  const raw = rubric.map((c, ci) => {
    const hit = taken.get(ci);
    if (!hit) return { criterionId: c.id, rating: null, rationale: `Insufficient evidence: nothing the candidate said addresses ${c.name.toLowerCase()}.`, evidence: [] };
    const p = pool[hit.pi];
    return {
      criterionId: c.id,
      rating: hit.score >= 3 ? 3 : 2,
      rationale: `The closest statement in the transcript to ${c.name.toLowerCase()} is “${gist(p.quote)}”. Mock-mode placeholder rating; a person should confirm it.`,
      evidence: [{ quote: p.quote, segmentId: p.segmentId }],
    };
  });
  const criteria = verifyAndFinalizeCriteria(raw, profile, interview.transcript);
  return {
    summary: `${DEMO_LABEL} Generated without an Anthropic key. Ratings are placeholders, but every quote is a whole sentence from the real transcript.`,
    recommendation: "human_review",
    recommendationReason: "Mock mode always recommends human review.",
    criteria,
    strengths: ["Gave concrete examples when asked."],
    concerns: ["Some claims were not quantified."],
    openQuestions: ["What was the measurement baseline for the latency claim?"],
    integrityNotes: summarizeIntegrity(interview),
    scorerModel: "mock-fixture",
    createdAt: new Date().toISOString(),
    demoData: true,
  };
}

export function summarizeIntegrity(interview: Interview): string[] {
  const counts = new Map<string, number>();
  for (const s of interview.integrity) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${n} ${k.replace("_", " ")} signal${n > 1 ? "s" : ""} recorded (metadata only, not a finding).`);
}
