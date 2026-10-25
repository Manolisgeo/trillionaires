// Demo dataset: backs up data/db.json to data/db.backup-<n>.json, then writes a curated, SYNTHETIC dataset through the
// store helpers. Run from web/: pnpm seed:demo
//   3 roles (2 approved, 1 AI-drafted awaiting review) and 5 candidates in five different states, each with a generated
//   one-page CV PDF in data/uploads/<id>/cv.pdf. One finished interview (mock report), one scheduled for a LIVE demo.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { fixtureBriefAndPlan, fixtureReport, fixtureRoleProfile } from "../src/lib/prep/fixtures";
import { DATA_DIR, store } from "../src/lib/store";
import type {
  Candidate, Claim, DeskEvent, EvidenceNote, Interview, Plan, PlannedQuestion, Role, RoleProfile, Segment, TimelineItem,
} from "../src/lib/types";

const iso = (s: string) => new Date(s).toISOString();

// ---------------------------------------------------------------- CV generator (pdf-lib, one Letter page) ----------
interface CvJob { org: string; title: string; dates: string; bullets: string[] }
interface CvSpec { name: string; headline: string; contact: string; summary: string; jobs: CvJob[]; extra: { heading: string; lines: string[] }[] }

async function makeCv(cv: CvSpec): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${cv.name} - CV (synthetic demo)`);
  doc.setAuthor("Aperture demo seed");
  const page = doc.addPage([612, 792]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const L = 54, R = 558, W = R - L;
  const ink = rgb(0.12, 0.15, 0.18), muted = rgb(0.36, 0.4, 0.44), line = rgb(0.75, 0.78, 0.8);
  let y = 738;
  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const out: string[] = [];
    let cur = "";
    for (const w of text.split(/\s+/)) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && cur) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const para = (text: string, font: PDFFont, size: number, x: number, width: number, lead: number, color = ink) => {
    for (const ln of wrap(text, font, size, width)) { page.drawText(ln, { x, y, size, font, color }); y -= lead; }
  };
  page.drawText(cv.name, { x: L, y, size: 22, font: bold, color: ink }); y -= 17;
  page.drawText(cv.headline, { x: L, y, size: 10.5, font: reg, color: muted }); y -= 14;
  page.drawText(cv.contact, { x: L, y, size: 9, font: reg, color: muted }); y -= 12;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1.2, color: ink }); y -= 17;
  const heading = (t: string) => {
    y -= 5;
    page.drawText(t.toUpperCase(), { x: L, y, size: 9, font: bold, color: ink });
    page.drawLine({ start: { x: L, y: y - 4 }, end: { x: R, y: y - 4 }, thickness: 0.5, color: line });
    y -= 17;
  };
  heading("Summary");
  para(cv.summary, reg, 10, L, W, 13.5);
  heading("Experience");
  for (const j of cv.jobs) {
    page.drawText(`${j.title}, ${j.org}`, { x: L, y, size: 10.5, font: bold, color: ink });
    const dw = reg.widthOfTextAtSize(j.dates, 9.5);
    page.drawText(j.dates, { x: R - dw, y, size: 9.5, font: reg, color: muted });
    y -= 15;
    for (const b of j.bullets) {
      page.drawText("•", { x: L + 4, y, size: 10, font: reg, color: ink });
      para(b, reg, 10, L + 16, W - 16, 13.2);
      y -= 1.5;
    }
    y -= 6;
  }
  for (const e of cv.extra) {
    heading(e.heading);
    for (const l of e.lines) para(l, reg, 10, L, W, 13.5);
  }
  page.drawText("Synthetic demo CV. The person, employers and figures are invented.", { x: L, y: 36, size: 8, font: reg, color: muted });
  assert(y > 48, `CV for ${cv.name} overflows one page (y=${y})`);
  return Buffer.from(await doc.save());
}

const cvText = (cv: CvSpec) => [cv.summary, ...cv.jobs.flatMap((j) => j.bullets), ...cv.extra.flatMap((e) => e.lines)].join(" ");
/** A claim whose CV quote is checked to be a verbatim substring of the generated CV, so the agent's highlight always lands. */
function claim(cv: CvSpec, id: string, text: string, skillIds: string[], quote: string): Claim {
  assert(cvText(cv).includes(quote), `quote not in ${cv.name}'s CV: ${quote}`);
  return { id, text, skillIds, source: { kind: "cv", quote, page: 1 } };
}

// ---------------------------------------------------------------- roles ---------------------------------------------
const GUARDRAILS = fixtureRoleProfile({ title: "x", company: "x" }).guardrailNotes;
const anchors = (weak: string, ok: string, strong: string) => ({ weak, ok, strong });

function backendProfile(): RoleProfile {
  const p = fixtureRoleProfile({ title: "Senior Backend Engineer", company: "Northwind" });
  p.summary = "Senior Backend Engineer at Northwind: owns payment and ledger services end to end, works with product and design, and raises the technical bar of the team.";
  return p;
}

function designerProfile(): RoleProfile {
  return {
    summary: "Product Designer at Northwind: designs the end-to-end flows of the merchant dashboard, works in the design system, and tests decisions with real users.",
    level: "mid-senior",
    mustHave: [
      { id: "s1", name: "Interaction design and prototyping", weight: 5, evidenceHints: ["flows they designed", "prototypes used in testing"] },
      { id: "s2", name: "Design systems", weight: 4, evidenceHints: ["components they own", "adoption across teams"] },
      { id: "s3", name: "User research", weight: 4, evidenceHints: ["usability sessions", "decisions changed by research"] },
    ],
    niceToHave: [{ id: "s4", name: "Data visualization", weight: 2, evidenceHints: ["dashboards", "charts for non-experts"] }],
    competencies: [
      { id: "c1", name: "Craft and detail", weight: 5, description: "Produces work that is clear, consistent and accessible.", anchors: anchors("Polish is inconsistent and rationale is missing.", "Consistent work with a clear rationale for the main choices.", "Every choice traces to a user need, with states and edge cases handled unprompted.") },
      { id: "c2", name: "Product thinking", weight: 4, description: "Frames the problem and the metric before the screen.", anchors: anchors("Starts from screens, not problems.", "States the problem and a success measure.", "Challenges the brief, picks a measurable outcome and shows what changed after launch.") },
      { id: "c3", name: "Working with engineers", weight: 4, description: "Shapes designs with the people who build them.", anchors: anchors("Hands off finished designs.", "Reviews builds and adjusts to constraints.", "Co-designs with engineers early and can name a tradeoff they chose together.") },
      { id: "c4", name: "Communication", weight: 3, description: "Explains design decisions to non-designers.", anchors: anchors("Describes what, not why.", "Gives clear reasons for decisions.", "Adapts the story to the listener and secures a decision.") },
    ],
    coreQuestions: [
      { id: "q1", competencyId: "c2", text: "Tell me about a design decision that you changed because of what users did, not what they said.", followUps: ["What did you measure?", "What did you ship instead?"] },
      { id: "q2", competencyId: "c3", text: "Describe a time an engineering constraint changed your design. How did you handle it?", followUps: ["What did you give up?"] },
      { id: "q3", competencyId: "c1", text: "Walk me through a flow you are proud of, including the states most people forget.", followUps: ["Which state was hardest?"] },
    ],
    technicalTopics: [
      { id: "t1", name: "Design system governance", difficulty: "mid", probes: ["How do you decide that a pattern becomes a component?", "How do you retire one?"] },
      { id: "t2", name: "Research methods", difficulty: "mid", probes: ["When is a usability test the wrong tool?"] },
    ],
    problems: [{
      id: "p1", title: "Redesign the merchant refund flow",
      prompt: "Sketch the screens and states for a merchant refunding part of an order, from the order list to the confirmation, including partial refunds and failures.",
      goodAnswerLooksLike: "States the user and the risk first, covers partial refunds, failure and undo, and says how they would test it.",
      constraintChanges: ["Refunds over a threshold need a second approver. What changes?", "Mobile only. What do you cut?"],
    }],
    guardrailNotes: GUARDRAILS,
  };
}

function csProfile(): RoleProfile {
  return {
    summary: "Customer Success Lead at Northwind (AI-drafted from the job description, needs review): owns onboarding and renewals for mid-market merchants and leads a team of four.",
    level: "lead",
    mustHave: [
      { id: "s1", name: "Onboarding and adoption", weight: 5, evidenceHints: ["time to first value", "playbooks they wrote"] },
      { id: "s2", name: "Renewals and expansion", weight: 4, evidenceHints: ["retention numbers", "expansion they closed"] },
      { id: "s3", name: "Team leadership", weight: 3, evidenceHints: ["people they coached", "hiring"] },
    ],
    niceToHave: [{ id: "s4", name: "Payments or fintech domain", weight: 2, evidenceHints: ["merchant or ledger knowledge"] }],
    competencies: [
      { id: "c1", name: "Customer empathy", weight: 5, description: "Understands what the customer is trying to achieve and acts on it.", anchors: anchors("Reacts to tickets only.", "Understands the customer goal and adapts.", "Anticipates needs and changes the product or process because of them.") },
      { id: "c2", name: "Ownership", weight: 4, description: "Drives an issue to resolution across teams.", anchors: anchors("Passes issues along.", "Follows an issue through to the customer.", "Fixes the root cause across teams and reports the result.") },
      { id: "c3", name: "Commercial judgment", weight: 4, description: "Balances customer goodwill and revenue.", anchors: anchors("Gives in or refuses by reflex.", "Weighs cost and goodwill.", "Finds the option that keeps the customer and the margin.") },
      { id: "c4", name: "Coaching", weight: 3, description: "Grows the people on the team.", anchors: anchors("Directs only.", "Gives specific feedback.", "Builds habits that outlast them.") },
    ],
    coreQuestions: [
      { id: "q1", competencyId: "c1", text: "Tell me about a customer you turned around. What did you do first?", followUps: ["How did you know it worked?"] },
      { id: "q2", competencyId: "c2", text: "Describe an issue you owned that crossed three teams.", followUps: ["Who pushed back?"] },
      { id: "q3", competencyId: "c3", text: "Tell me about a time you said no to a customer request.", followUps: ["What did they do next?"] },
    ],
    technicalTopics: [{ id: "t1", name: "Renewal forecasting", difficulty: "mid", probes: ["How do you predict churn risk?"] }],
    problems: [{
      id: "p1", title: "Plan the first 90 days for a new merchant",
      prompt: "Sketch the onboarding milestones, owners and signals of risk for a mid-market merchant moving from another processor.",
      goodAnswerLooksLike: "Defines first value, names risks early and shows who owns each step.",
      constraintChanges: ["The merchant's integration slips by a month. What changes?"],
    }],
    guardrailNotes: GUARDRAILS,
  };
}

// ---------------------------------------------------------------- candidates ----------------------------------------
const MAYA_CV: CvSpec = {
  name: "Maya Okafor", headline: "Staff Software Engineer, payments and ledgers", contact: "maya.okafor@example.com  |  github.com/mokafor-demo  |  Austin, TX",
  summary: "Backend engineer with ten years of experience building payment, ledger and logistics services in Go, Python and PostgreSQL. Comfortable owning a service from design through on-call.",
  jobs: [
    { org: "Lumen Payments", title: "Staff Software Engineer", dates: "2021 - present", bullets: [
      "Led migration of the ledger service from a Rails monolith to Go services, cutting p99 latency from 480ms to 90ms.",
      "Designed idempotent payment retries on Kafka handling 4M events per day with exactly-once effects.",
      "Mentored 5 engineers and cut pages by 40% through runbook automation." ] },
    { org: "Cobalt Logistics", title: "Senior Software Engineer", dates: "2018 - 2021", bullets: [
      "Built route-optimization APIs in Python and PostgreSQL serving 300 requests per second.",
      "Introduced contract tests across twelve services after two integration incidents in one quarter." ] },
    { org: "Brightpath Labs", title: "Software Engineer", dates: "2015 - 2018", bullets: ["Built internal billing dashboards and report exports in Ruby on Rails."] },
  ],
  extra: [
    { heading: "Open source", lines: ["pgqueue: durable job queue on PostgreSQL SKIP LOCKED, used in production at two startups."] },
    { heading: "Education", lines: ["B.S. Computer Science, University of Texas at Austin, 2015"] },
  ],
};
const DANIEL_CV: CvSpec = {
  name: "Daniel Ferreira", headline: "Backend Engineer, data pipelines", contact: "daniel.ferreira@example.com  |  github.com/dferreira-demo  |  Porto, Portugal",
  summary: "Backend engineer with nine years of experience in ingestion pipelines, scheduling APIs and embedded storage. Prefers Rust for hot paths and Python for everything around them.",
  jobs: [
    { org: "Harbor Metrics", title: "Backend Engineer", dates: "2021 - present", bullets: [
      "Rebuilt the metrics ingestion pipeline in Rust, doubling throughput to 60k points per second.",
      "Ran the on-call rotation for a team of six and wrote the incident runbooks.",
      "Introduced schema-migration review, which removed unplanned downtime during deploys." ] },
    { org: "Tidewater Systems", title: "Software Engineer", dates: "2017 - 2021", bullets: [
      "Built a Django REST API for fleet scheduling used by 40 depots.",
      "Moved nightly batch jobs from cron onto Celery workers on Redis." ] },
  ],
  extra: [
    { heading: "Projects", lines: ["tsdb-lite: an embedded time-series store in Rust, 210 stars."] },
    { heading: "Education", lines: ["B.Sc. Informatics, University of Porto, 2017"] },
  ],
};
const HANA_CV: CvSpec = {
  name: "Hana Lindqvist", headline: "Senior Software Engineer, commerce platforms", contact: "hana.lindqvist@example.com  |  Gothenburg, Sweden",
  summary: "Senior engineer with ten years of experience on order routing, checkout and storefront APIs. Leads small teams through migrations.",
  jobs: [
    { org: "Nordlight Retail", title: "Senior Software Engineer", dates: "2020 - present", bullets: [
      "Designed the order-routing service handling 1.2M orders a month on PostgreSQL and RabbitMQ.",
      "Cut checkout error rate from 2.1% to 0.4% by adding idempotent order submission.",
      "Led a team of four through a TypeScript migration of the storefront API." ] },
    { org: "Fjord Labs", title: "Software Engineer", dates: "2016 - 2020", bullets: [
      "Built reporting queries and materialized views for a 300 GB analytics database.",
      "Wrote the on-call tooling used by three product teams." ] },
  ],
  extra: [
    { heading: "Skills", lines: ["TypeScript, Go, PostgreSQL, RabbitMQ, Terraform"] },
    { heading: "Education", lines: ["M.Sc. Computer Science, Chalmers University of Technology, 2016"] },
  ],
};
const KENJI_CV: CvSpec = {
  name: "Kenji Watanabe", headline: "Backend Engineer, scheduling and health data", contact: "kenji.watanabe@example.com  |  github.com/kwatanabe-demo  |  Vancouver, Canada",
  summary: "Backend engineer with seven years of experience in TypeScript services on PostgreSQL. Cares about query plans, migrations that do not page anyone, and boring deploys.",
  jobs: [
    { org: "Tidepool Health", title: "Backend Engineer", dates: "2020 - present", bullets: [
      "Built the appointment-scheduling API in TypeScript and PostgreSQL, serving 120 requests per second at peak.",
      "Reduced p95 latency of the search endpoint from 900ms to 210ms by adding a covering index and rewriting two queries.",
      "Led the move from a single Postgres instance to a primary with two read replicas with no downtime." ] },
    { org: "Quayside Software", title: "Software Engineer", dates: "2017 - 2020", bullets: [
      "Wrote the Node.js service that syncs clinic calendars, handling 2M updates a day.",
      "Replaced hand-written SQL migrations with a reviewed, versioned migration process." ] },
  ],
  extra: [{ heading: "Education", lines: ["B.Sc. Computer Science, University of British Columbia, 2017"] }],
};
const LUCIA_CV: CvSpec = {
  name: "Lucia Marchetti", headline: "Product Designer, B2B analytics", contact: "lucia.marchetti@example.com  |  luciamarchetti.example  |  Milan, Italy",
  summary: "Product designer with eight years of experience designing dashboards and onboarding for analytics products. Works in code-adjacent tools and runs her own research.",
  jobs: [
    { org: "Orbit Analytics", title: "Senior Product Designer", dates: "2021 - present", bullets: [
      "Redesigned the onboarding flow, lifting week-one activation from 31% to 46%.",
      "Built and maintained a design system of 64 components used by five product teams.",
      "Ran 30 moderated usability sessions across two product launches." ] },
    { org: "Studio Rovere", title: "Interaction Designer", dates: "2018 - 2021", bullets: [
      "Designed a chart library for non-technical readers, adopted in three client dashboards.",
      "Prototyped in Figma and coded interaction prototypes in React for usability tests." ] },
  ],
  extra: [
    { heading: "Tools", lines: ["Figma, Storybook, React prototyping, Maze, Dovetail"] },
    { heading: "Education", lines: ["M.A. Interaction Design, Politecnico di Milano, 2018"] },
  ],
};

const flag = (id: string, kind: "gap" | "inconsistency" | "unverified" | "other", text: string, claimIds: string[]) => ({ id, kind, text, claimIds });
const timeline = (org: string, title: string, start: string, end: string | null, claimIds: string[]): TimelineItem => ({ org, title, start, end, claimIds });

// ---------------------------------------------------------------- Maya's finished interview -------------------------
function mayaInterview(role: Role, candidate: Candidate, claims: Claim[]): Omit<Interview, "id" | "createdAt"> {
  const prof = role.profile!;
  const core = prof.coreQuestions.map((q): PlannedQuestion => ({ id: q.id, kind: "core", text: q.text, competencyId: q.competencyId, skillId: null, source: null, followUps: q.followUps }));
  const probe = (id: string, text: string, competencyId: string | null, skillId: string | null, claimIdx: number, followUps: string[]): PlannedQuestion => ({
    id, kind: "probe", text, competencyId, skillId, source: claims[claimIdx]?.source ?? null, followUps,
  });
  const pLedger = probe("pr-ledger", "You led the migration of the ledger service from a Rails monolith to Go services. What did you decide yourself, and what did the team decide?", "c2", "s1", 0, ["How did you know the new service was ready to take writes?"]);
  const pKafka = probe("pr-kafka", "Your CV mentions idempotent payment retries on Kafka. How do you get effectively-once effects when the consumer crashes?", "c1", "s1", 1, ["Where does the offset commit fit?"]);
  const pPython = probe("pr-python", "You built route-optimization APIs in Python. How much of that ran in production, and what did you own?", null, "s2", 2, ["What did you test, and how?"]);
  const pModel = probe("pr-model", "How would you design the data model for event ingestion at fifty thousand events per second?", null, "s3", -1, ["Where could it break?"]);
  const plan: Plan = {
    phases: [
      { phase: "intro", minutes: 2, objectives: ["Disclose that Aperture is an AI, explain recording and how the call works", "Put the candidate at ease"], questions: [] },
      { phase: "behavioral", minutes: 10, objectives: ["Collect STAR evidence on ownership and collaboration"], questions: core },
      { phase: "background", minutes: 8, objectives: ["Verify the headline claims on the CV with concrete detail"], questions: [pLedger, pKafka, pPython] },
      { phase: "technical", minutes: 15, objectives: ["Assess service and data design on the shared board"], questions: [pModel], problemId: "p1" },
      { phase: "close", minutes: 3, objectives: ["Answer the candidate's questions about the process", "Explain next steps and that a human decides"], questions: [] },
    ],
  };
  const T = (id: number, speaker: Segment["speaker"], start: number, end: number, text: string): Segment => ({ id: `seg${id}`, speaker, start, end, text });
  const transcript: Segment[] = [
    T(1, "agent", 0, 34, "Thanks for joining, Maya. I am Aperture, an AI interviewer. This call is recorded and a person at Northwind reviews it. Let's start with a time you took ownership of a problem nobody had asked you to solve."),
    T(2, "candidate", 38, 82, "Our nightly balance reconciliation was failing silently for weeks. Nobody had asked me to fix it, so I wrote the alerting myself and ran it for a month before proposing it to the team. It caught a currency rounding bug in the first week."),
    T(3, "agent", 86, 110, "What did you do yourself, and how did you measure the result?"),
    T(4, "candidate", 114, 160, "I set an exit criterion up front: fourteen consecutive nights with zero balance drift across all tenants. We hit it on day sixteen after I fixed the rounding bug in currency conversion."),
    T(5, "agent", 164, 186, "Describe a technical disagreement with a teammate. How did it end?"),
    T(6, "candidate", 190, 240, "A teammate wanted to cut over in a single weekend, and I thought that was too risky. We wrote down what each of us was afraid of, and agreed to run both ledgers in parallel behind an explicit exit criterion. He ended up owning the comparison dashboard, which made the call easy for everyone."),
    T(7, "agent", 244, 270, "Tell me about the hardest production incident you handled."),
    T(8, "candidate", 274, 330, "I shipped a retry change that doubled webhook deliveries to a partner. I reproduced it by replaying an hour of traffic in staging, which showed the retries were dropping the original idempotency key. I paged the owner within ten minutes, rolled back, and wrote the review the next morning."),
    T(9, "agent", 334, 372, "Let's look at your CV. You led the migration of the ledger service from a Rails monolith to Go services. What did you decide yourself, and what did the team decide?"),
    T(10, "candidate", 376, 430, "I decided the cutover strategy and wrote the design document. The team chose the Go service boundaries after two review sessions. I owned the parallel-run plan and the go or no-go call."),
    T(11, "agent", 434, 462, "Your CV mentions idempotent payment retries on Kafka. How do you get effectively-once effects?"),
    T(12, "candidate", 466, 520, "Every command carries a deterministic idempotency key. The consumer writes the key and the effect in one Postgres transaction, so a redelivered message hits a unique constraint and is skipped. That is exactly the case the constraint is there for."),
    T(13, "agent", 524, 550, "You built route-optimization APIs in Python. What did you own there?"),
    T(14, "candidate", 554, 600, "The route-optimization APIs were Python on PostgreSQL, serving about three hundred requests per second. I owned the service end to end, including the contract tests across twelve services after two integration incidents in one quarter."),
    T(15, "agent", 604, 640, "Let's go to the board. How would you design the data model for ingestion at fifty thousand events per second?"),
    T(16, "candidate", 644, 720, "I would walk through the failure modes out loud first: duplicates, ordering and poison messages. Then I would partition by shipment id so ordering holds per shipment, keep one narrow events table with a unique key on shipment id and sequence, and batch writes into Postgres with COPY. I would index on shipment id and sequence so a replay is a range scan, and watch consumer lag as the primary alert."),
  ];
  const ev = (seq: number, t: number, type: string, payload: unknown): DeskEvent => ({ seq, t, type, payload });
  const ask = (q: PlannedQuestion) => ({ text: q.text, kind: q.kind });
  const hl = (q: PlannedQuestion) => ({ id: q.id, quote: q.source?.quote ?? "", page: q.source?.page ?? 1, note: "Asking about this line" });
  const planPhase = (i: number) => ({ phase: plan.phases[i].phase, index: i, total: plan.phases.length, endsAt: null });
  const events: DeskEvent[] = [
    ev(0, 0, "phase", planPhase(0)), ev(1, 14, "phase", planPhase(1)),
    ev(2, 18, "question", ask(core[0])), ev(3, 164, "question", ask(core[1])), ev(4, 244, "question", ask(core[2])),
    ev(5, 326, "phase", planPhase(2)),
    ev(6, 332, "cv.highlight", hl(pLedger)), ev(7, 334, "question", ask(pLedger)),
    ev(8, 432, "cv.highlight", hl(pKafka)), ev(9, 434, "question", ask(pKafka)),
    ev(10, 522, "cv.highlight", hl(pPython)), ev(11, 524, "question", ask(pPython)),
    ev(12, 598, "phase", planPhase(3)), ev(13, 604, "question", ask(pModel)),
    ev(14, 730, "phase", planPhase(4)), ev(15, 758, "ended", { reason: "completed" }),
  ];
  const base = {
    roleId: role.id, candidateId: candidate.id, mode: "room" as const, meetUrl: null, recallBotId: null, status: "done" as const,
    brief: {
      items: [
        { bucket: "matched" as const, skillOrCompetencyId: "s1", claimId: "cl1", note: "Ledger migration from a Rails monolith to Go services, with a stated latency result." },
        { bucket: "matched" as const, skillOrCompetencyId: "s3", claimId: "cl5", note: "Maintains a PostgreSQL-backed job queue used in production at two startups." },
        { bucket: "unverified" as const, skillOrCompetencyId: "s2", claimId: "cl3", note: "Python in production is on the CV but dated 2018 to 2021." },
        { bucket: "flag" as const, skillOrCompetencyId: null, claimId: "cl1", note: "The p99 latency figures do not say how they were measured." },
      ],
    },
    plan, startedAt: iso("2026-10-24T14:02:00Z"), endedAt: iso("2026-10-24T14:14:40Z"), recording: null,
    transcript, events, evidence: [] as EvidenceNote[], integrity: [], board: null, report: null as Interview["report"],
  };
  // The mock scorer assigns verbatim quotes by relevance; the evidence notes mirror what it cited.
  const stub = { ...base, id: "x", createdAt: iso("2026-10-24T14:20:00Z") } as Interview;
  const report = { ...fixtureReport(stub, role), createdAt: iso("2026-10-24T14:20:00Z") };
  base.evidence = report.criteria.flatMap((c) => c.evidence.slice(0, 1).map((e, i): EvidenceNote => ({
    id: `e-${c.criterionId}-${i}`, t: e.t, competencyId: c.kind === "competency" ? c.criterionId : null, skillId: c.kind === "skill" ? c.criterionId : null,
    note: `Evidence for ${c.name}.`, segmentId: e.segmentId,
  })));
  base.report = report;
  return base;
}

// ---------------------------------------------------------------- main ----------------------------------------------
async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, "db.json");
  const exists = (p: string) => fs.stat(p).then(() => true, () => false);
  if (await exists(dbPath)) {
    let n = 1;
    while (await exists(path.join(DATA_DIR, `db.backup-${n}.json`))) n++;
    const backup = path.join(DATA_DIR, `db.backup-${n}.json`);
    await fs.copyFile(dbPath, backup);
    console.log(`backed up db.json -> ${path.basename(backup)}`);
  }
  await fs.writeFile(dbPath, JSON.stringify({ roles: [], candidates: [], interviews: [] }, null, 2), "utf8");

  const dated = async (table: "roles" | "candidates" | "interviews", id: string, createdAt: string) => {
    await (store[table].update as (id: string, patch: { createdAt: string }) => Promise<unknown>)(id, { createdAt: iso(createdAt) });
  };

  // roles
  const role1 = await store.roles.create({
    title: "Senior Backend Engineer", company: "Northwind", status: "approved", profile: backendProfile(), demoData: true,
    jdText: "Build and run the services behind payments and ledgers at Northwind. Own reliability, data design and on-call with a small team. Strong TypeScript or Python in production, PostgreSQL, and a habit of writing things down.",
  });
  const role2 = await store.roles.create({
    title: "Product Designer", company: "Northwind", status: "approved", profile: designerProfile(), demoData: true,
    jdText: "Design the merchant dashboard end to end, from onboarding to refunds. Work in the design system, test with real merchants, and sit next to the engineers building it.",
  });
  const role3 = await store.roles.create({
    title: "Customer Success Lead", company: "Northwind", status: "draft", profile: csProfile(), demoData: true,
    jdText: "Lead onboarding and renewals for mid-market merchants. Coach a team of four, own retention numbers and turn what customers tell you into product changes.",
  });
  await dated("roles", role1.id, "2026-10-22T09:00:00Z");
  await dated("roles", role2.id, "2026-10-23T11:00:00Z");
  await dated("roles", role3.id, "2026-10-25T09:30:00Z");

  // candidate helper: creates the record, then writes the CV and points cvPath at it
  const addCandidate = async (
    role: Role, cv: CvSpec, extra: Pick<Candidate, "research" | "profile" | "reviewedAt" | "githubHandle" | "links">, when: string,
  ): Promise<Candidate> => {
    const [first, ...rest] = cv.name.toLowerCase().split(" ");
    const c = await store.candidates.create({
      roleId: role.id, name: cv.name, email: `${first}.${rest.join("")}@example.com`,
      cvPath: "", linkedinPdfPath: null, consentAt: iso(when), demoData: true, ...extra,
    });
    await fs.mkdir(path.join(DATA_DIR, "uploads", c.id), { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, "uploads", c.id, "cv.pdf"), await makeCv(cv));
    return store.candidates.update(c.id, { cvPath: `uploads/${c.id}/cv.pdf`, createdAt: iso(when) });
  };

  // 1. Maya: research done, reviewed by the candidate, interview done with a mock report
  const mayaClaims: Claim[] = [
    claim(MAYA_CV, "cl1", "Led the migration of the ledger service from a Rails monolith to Go services, cutting p99 latency from 480ms to 90ms.", ["s1"], "Led migration of the ledger service from a Rails monolith to Go services"),
    claim(MAYA_CV, "cl2", "Designed idempotent payment retries on Kafka handling 4M events per day with exactly-once effects.", ["s1", "s3"], "Designed idempotent payment retries on Kafka handling 4M events per day"),
    claim(MAYA_CV, "cl3", "Built route-optimization APIs in Python and PostgreSQL serving 300 requests per second.", ["s2"], "Built route-optimization APIs in Python and PostgreSQL serving 300 requests per second"),
    claim(MAYA_CV, "cl4", "Mentored 5 engineers and cut on-call pages by 40% through runbook automation.", [], "cut pages by 40% through runbook automation"),
    { id: "cl5", text: "Maintains pgqueue, a durable job queue on PostgreSQL SKIP LOCKED used in production at two startups.", skillIds: ["s3"], source: { kind: "github", quote: "pgqueue: durable job queue on PostgreSQL SKIP LOCKED", url: "https://github.com/mokafor-demo/pgqueue" } },
  ];
  const maya = await addCandidate(role1, MAYA_CV, {
    research: "done", reviewedAt: iso("2026-10-24T13:52:00Z"), githubHandle: "mokafor-demo", links: ["https://github.com/mokafor-demo"],
    profile: {
      headline: "Maya Okafor, senior backend engineer with 10 years of experience, now Staff Software Engineer at Lumen Payments",
      claims: mayaClaims,
      timeline: [
        timeline("Lumen Payments", "Staff Software Engineer", "2021-01", null, ["cl1", "cl2", "cl4"]),
        timeline("Cobalt Logistics", "Senior Software Engineer", "2018-01", "2021-01", ["cl3"]),
        timeline("Brightpath Labs", "Software Engineer", "2015-06", "2018-01", []),
      ],
      flags: [
        flag("f1", "unverified", "The p99 latency figures (480ms to 90ms) do not say how or over what window they were measured.", ["cl1"]),
        flag("f2", "unverified", "Python in production is dated 2018 to 2021; the role asks for current TypeScript or Python.", ["cl3"]),
      ],
      github: null, webFindings: [],
    },
  }, "2026-10-24T13:38:00Z");
  const mayaIv = await store.interviews.create(mayaInterview(role1, maya, mayaClaims));
  await dated("interviews", mayaIv.id, "2026-10-24T13:55:00Z");

  // 2. Daniel: researched, reviewed, interview scheduled and ready for the LIVE demo
  const danClaims: Claim[] = [
    claim(DANIEL_CV, "cl1", "Rebuilt the metrics ingestion pipeline in Rust, doubling throughput to 60k points per second.", ["s1"], "Rebuilt the metrics ingestion pipeline in Rust, doubling throughput to 60k points per second"),
    claim(DANIEL_CV, "cl2", "Built a Django REST API for fleet scheduling used by 40 depots.", ["s2"], "Built a Django REST API for fleet scheduling used by 40 depots"),
    claim(DANIEL_CV, "cl3", "Introduced schema-migration review, which removed unplanned downtime during deploys.", ["s3"], "Introduced schema-migration review, which removed unplanned downtime during deploys"),
    { id: "cl4", text: "Maintains tsdb-lite, an embedded time-series store in Rust with 210 stars.", skillIds: ["s3"], source: { kind: "github", quote: "tsdb-lite: an embedded time-series store in Rust", url: "https://github.com/dferreira-demo/tsdb-lite" } },
  ];
  const dan = await addCandidate(role1, DANIEL_CV, {
    research: "done", reviewedAt: iso("2026-10-25T08:22:00Z"), githubHandle: "dferreira-demo", links: ["https://github.com/dferreira-demo"],
    profile: {
      headline: "Daniel Ferreira, backend engineer with 9 years of experience, now at Harbor Metrics",
      claims: danClaims,
      timeline: [timeline("Harbor Metrics", "Backend Engineer", "2021-02", null, ["cl1", "cl3"]), timeline("Tidewater Systems", "Software Engineer", "2017-07", "2021-01", ["cl2"])],
      flags: [
        flag("f1", "unverified", "The doubled-throughput claim names no baseline.", ["cl1"]),
        flag("f2", "gap", "No TypeScript on the CV; Python appears only for the 2017 to 2021 role.", []),
      ],
      github: null, webFindings: [],
    },
  }, "2026-10-25T08:05:00Z");
  const { brief, plan } = fixtureBriefAndPlan(role1, dan);
  const danIv = await store.interviews.create({
    roleId: role1.id, candidateId: dan.id, mode: "room", meetUrl: null, recallBotId: null, status: "scheduled",
    brief: { items: brief.items.map((i) => ({ ...i, note: i.note.replace("[Demo data] ", "") })) }, plan,
    startedAt: null, endedAt: null, recording: null, transcript: [], events: [], evidence: [], integrity: [], board: null, report: null,
  });
  await dated("interviews", danIv.id, "2026-10-25T08:30:00Z");

  // 3. Hana: research still running
  const hana = await addCandidate(role1, HANA_CV, { research: "running", profile: null, reviewedAt: null, githubHandle: null, links: [] }, "2026-10-25T10:35:00Z");

  // 4. Kenji: researched and reviewed, no interview prepared yet
  const kenjiClaims: Claim[] = [
    claim(KENJI_CV, "cl1", "Built the appointment-scheduling API in TypeScript and PostgreSQL, serving 120 requests per second at peak.", ["s1", "s2"], "Built the appointment-scheduling API in TypeScript and PostgreSQL, serving 120 requests per second at peak"),
    claim(KENJI_CV, "cl2", "Cut p95 latency of the search endpoint from 900ms to 210ms with a covering index and two rewritten queries.", ["s3"], "Reduced p95 latency of the search endpoint from 900ms to 210ms by adding a covering index and rewriting two queries"),
    claim(KENJI_CV, "cl3", "Led the move to a Postgres primary with two read replicas with no downtime.", ["s1", "s3"], "Led the move from a single Postgres instance to a primary with two read replicas with no downtime"),
  ];
  const kenji = await addCandidate(role1, KENJI_CV, {
    research: "done", reviewedAt: iso("2026-10-25T09:50:00Z"), githubHandle: null, links: [],
    profile: {
      headline: "Kenji Watanabe, backend engineer with 7 years of experience, now at Tidepool Health",
      claims: kenjiClaims,
      timeline: [timeline("Tidepool Health", "Backend Engineer", "2020-03", null, ["cl1", "cl2", "cl3"]), timeline("Quayside Software", "Software Engineer", "2017-06", "2020-02", [])],
      flags: [
        flag("f1", "unverified", "The latency improvement does not say which workload it was measured on.", ["cl2"]),
        flag("f2", "gap", "No evidence of event-driven or streaming systems.", []),
      ],
      github: null, webFindings: [],
    },
  }, "2026-10-25T09:30:00Z");

  // 5. Lucia: applied for the designer role; research done, waiting for her to review it
  const luciaClaims: Claim[] = [
    claim(LUCIA_CV, "cl1", "Redesigned the onboarding flow, lifting week-one activation from 31% to 46%.", ["s1"], "Redesigned the onboarding flow, lifting week-one activation from 31% to 46%"),
    claim(LUCIA_CV, "cl2", "Built and maintains a design system of 64 components used by five product teams.", ["s2"], "Built and maintained a design system of 64 components used by five product teams"),
    claim(LUCIA_CV, "cl3", "Ran 30 moderated usability sessions across two product launches.", ["s3"], "Ran 30 moderated usability sessions across two product launches"),
  ];
  const lucia = await addCandidate(role2, LUCIA_CV, {
    research: "done", reviewedAt: null, githubHandle: null, links: [],
    profile: {
      headline: "Lucia Marchetti, product designer with 8 years of experience, now Senior Product Designer at Orbit Analytics",
      claims: luciaClaims,
      timeline: [timeline("Orbit Analytics", "Senior Product Designer", "2021-02", null, ["cl1", "cl2", "cl3"]), timeline("Studio Rovere", "Interaction Designer", "2018-09", "2021-01", [])],
      flags: [flag("f1", "unverified", "The activation lift does not say over what period or cohort it was measured.", ["cl1"])],
      github: null, webFindings: [],
    },
  }, "2026-10-25T11:10:00Z");

  const [roles, candidates, interviews] = await Promise.all([store.roles.list(), store.candidates.list(), store.interviews.list()]);
  console.log(`seeded ${roles.length} roles, ${candidates.length} candidates (one CV PDF each), ${interviews.length} interviews`);
  for (const c of [maya, dan, hana, kenji, lucia]) console.log(`  ${c.name.padEnd(18)} research ${c.research}${c.reviewedAt ? ", reviewed" : ""}  data/uploads/${c.id}/cv.pdf`);
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  console.log("\nOpen:");
  console.log(`  catalog          ${base}/`);
  console.log(`  LIVE demo room   ${base}/room/${danIv.id}   (Daniel Ferreira, Senior Backend Engineer)`);
  console.log(`  room preview     ${base}/room/${danIv.id}?preview=1`);
  console.log(`  recruiter view   ${base}/interviews/${danIv.id}`);
  console.log(`  report (mock)    ${base}/reports/${mayaIv.id}   (Maya Okafor)`);
  console.log(`  designer role    ${base}/roles/${role2.id}`);
  console.log(`  draft role       ${base}/roles/${role3.id}`);
  void [hana, lucia];
}
main().catch((e) => { console.error(e); process.exit(1); });
