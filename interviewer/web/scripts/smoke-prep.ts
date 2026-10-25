// Smoke test for the prep module in mock mode (no API calls). Run: pnpm exec tsx scripts/smoke-prep.ts
delete process.env.ANTHROPIC_API_KEY;
process.env.DEMO_SHORT_INTERVIEW = "1";

import assert from "node:assert/strict";
import { compileBriefAndPlan, draftRoleProfile, researchCandidate, scoreInterview, isMockMode } from "../src/lib/prep";
import { verifyAndFinalizeCriteria } from "../src/lib/scoring";
import type { Candidate, Interview, Role } from "../src/lib/types";

async function main() {
  assert(isMockMode(), "expected mock mode");
  const now = new Date().toISOString();
  const profile = await draftRoleProfile({ title: "Senior Backend Engineer", company: "Acme", jdText: "Build APIs." });
  assert(profile.competencies.length >= 4 && profile.coreQuestions.length >= 3);
  const role: Role = { id: "r1", title: "Senior Backend Engineer", company: "Acme", jdText: "Build APIs.", status: "approved", profile, createdAt: now, demoData: true };

  const cand: Candidate = {
    id: "c1", roleId: "r1", name: "Ada Demo", email: "ada@example.com", cvPath: "uploads/c1/cv.pdf", linkedinPdfPath: null,
    githubHandle: null, links: [], consentAt: now, research: "running", profile: null, reviewedAt: null, createdAt: now, demoData: true,
  };
  cand.profile = await researchCandidate({ candidate: cand, role });
  assert(cand.profile.claims.length > 0 && cand.profile.claims[0].source.quote);

  const { brief, plan } = await compileBriefAndPlan({ role, candidate: cand });
  const beh = plan.phases.find((p) => p.phase === "behavioral")!;
  assert.deepEqual(beh.questions.slice(0, profile.coreQuestions.length).map((q) => q.id), profile.coreQuestions.map((q) => q.id));
  assert.deepEqual(plan.phases.map((p) => p.minutes), [1, 3, 3, 4, 1]);
  assert(plan.phases.find((p) => p.phase === "technical")!.problemId);
  assert(plan.phases.find((p) => p.phase === "background")!.questions.every((q) => q.source));

  const transcript = [
    { id: "g1", speaker: "agent" as const, text: "Tell me about ownership.", start: 5, end: 8 },
    { id: "g2", speaker: "candidate" as const, text: "I noticed our billing   API kept timing out, so I rewrote the retry layer and cut errors by half.", start: 10, end: 20 },
    { id: "g3", speaker: "candidate" as const, text: "We disagreed on queues, and I wrote a short design doc to compare the options with numbers.", start: 30, end: 40 },
  ];
  const interview = {
    id: "i1", roleId: "r1", candidateId: "c1", mode: "room", meetUrl: null, recallBotId: null, status: "processing", brief, plan,
    startedAt: now, endedAt: now, recording: null, transcript, events: [], evidence: [],
    integrity: [{ t: 50, kind: "tab_hidden" }], board: null, report: null, createdAt: now,
  } satisfies Interview;
  const report = await scoreInterview({ interview, role, candidate: cand });
  assert.equal(report.demoData, true);
  assert.equal(report.criteria.length, profile.competencies.length + profile.mustHave.length);
  for (const c of report.criteria) for (const e of c.evidence) {
    const seg = transcript.find((s) => s.id === e.segmentId)!;
    assert(seg.text.replace(/\s+/g, " ").includes(e.quote), `quote not verbatim: ${e.quote}`);
  }

  // Verbatim verification: whitespace-normalized match kept, fabricated quote dropped -> rating null.
  const v = verifyAndFinalizeCriteria([
    { criterionId: "c1", rating: 3, rationale: "x", evidence: [{ quote: "billing API kept timing out", segmentId: "g2" }] },
    { criterionId: "c2", rating: 3, rationale: "x", evidence: [{ quote: "I single-handedly saved the company", segmentId: "g2" }] },
  ], profile, transcript);
  assert.equal(v.find((c) => c.criterionId === "c1")!.rating, 3);
  assert.equal(v.find((c) => c.criterionId === "c2")!.rating, null);
  assert.equal(v.find((c) => c.criterionId === "c3")!.rating, null);

  console.log("prep smoke OK (mock mode)");
  console.log(`  role: ${profile.competencies.length} competencies, ${profile.coreQuestions.length} core questions, ${profile.problems.length} problem(s)`);
  console.log(`  candidate: "${cand.profile.headline}", ${cand.profile.claims.length} claims, ${cand.profile.flags.length} flags`);
  console.log(`  brief: ${brief.items.map((b) => b.bucket).join(", ")}`);
  console.log(`  plan: ${plan.phases.map((p) => `${p.phase}(${p.minutes}m,${p.questions.length}q)`).join(" ")}`);
  console.log(`  report: ${report.recommendation}, ratings ${report.criteria.map((c) => c.rating ?? "-").join("")}, ${report.integrityNotes.join("; ")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
