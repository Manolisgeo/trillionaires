import fs from "node:fs/promises";
import path from "node:path";
import type { Candidate, CandidateProfile, Claim, Role } from "../types";
import { DATA_DIR } from "../store";
import { callStructured, isMockMode, pdfBlock, UNTRUSTED_RULE, type ContentBlock } from "../claude";
import { ResearchOutZ } from "./schemas";
import { fixtureCandidateProfile } from "./fixtures";
import { fetchGithub, searchOwnDomains } from "./research-sources";

const SYSTEM = `You extract a verified background summary of a job candidate for an AI interviewer. Output follows the schema exactly.
${UNTRUSTED_RULE}
Rules:
- claims: 6-15 concrete, checkable statements (roles, projects, results, technologies). Each source.quote MUST be an exact, verbatim, contiguous snippet (under 25 words) copied from the document it came from, so a PDF text search finds it. source.kind is "cv" for the CV, "linkedin" for the LinkedIn PDF, "github" for repos, "web" for pages. Set page (1-based) for PDFs and url for github/web, else null.
- skillIds: ids of the role's must-have / nice-to-have skills the claim is evidence for (only the given ids), else [].
- timeline: employment and education in order, ISO-ish dates (YYYY-MM or YYYY), end null if current; claimIds from your claims.
- flags: neutral observations for the interviewer to explore, never accusations: gap (unexplained timeline gap or missing required skill evidence), inconsistency (CV vs LinkedIn/GitHub mismatch), unverified (impressive claim with no baseline or corroboration), other. Do not infer or mention protected characteristics (age, nationality, family status, health).
- webFindings: only pages actually provided to you below (url must match), 1-2 sentence summary each, relevant to the role.
- headline: one line, role and years of experience, no adjectives of praise.
- ids: short and unique (cl1.., f1..).`;

function resolveUpload(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(DATA_DIR, p);
}

export async function researchCandidate(i: { candidate: Candidate; role: Role }): Promise<CandidateProfile> {
  const { candidate, role } = i;
  if (isMockMode()) return fixtureCandidateProfile(candidate, role);

  const content: ContentBlock[] = [];
  const labels: string[] = [];
  const cv = await fs.readFile(resolveUpload(candidate.cvPath)).catch((e) => {
    throw new Error(`Cannot read CV at ${candidate.cvPath}: ${(e as Error).message}`);
  });
  content.push(pdfBlock(cv));
  labels.push("Document 1 is the candidate's CV (kind cv).");
  if (candidate.linkedinPdfPath) {
    const li = await fs.readFile(resolveUpload(candidate.linkedinPdfPath)).catch(() => null);
    if (li) {
      content.push(pdfBlock(li));
      labels.push(`Document ${content.length} is the candidate's LinkedIn PDF export (kind linkedin).`);
    }
  }

  const [github, pages] = await Promise.all([
    candidate.githubHandle ? fetchGithub(candidate.githubHandle) : Promise.resolve(null),
    searchOwnDomains(candidate, role.title),
  ]);

  const skills = [...(role.profile?.mustHave ?? []), ...(role.profile?.niceToHave ?? [])].map((s) => ({ id: s.id, name: s.name }));
  let text = `${labels.join(" ")}\nRole: ${role.title} at ${role.company}\n<role_skills>\n${JSON.stringify(skills)}\n</role_skills>\n`;
  if (github) text += `<untrusted_github handle="${github.handle}">\n${JSON.stringify(github.repos)}\n</untrusted_github>\n`;
  for (const p of pages) text += `<untrusted_web url="${p.url}" title="${p.title.replace(/"/g, "'")}">\n${p.text}\n</untrusted_web>\n`;
  text += "Extract the candidate background.";
  content.push({ type: "text", text });

  const out = await callStructured({ kind: "prep", system: SYSTEM, content, schema: ResearchOutZ });

  const skillIds = new Set(skills.map((s) => s.id));
  const seen = new Set<string>();
  const claims: Claim[] = [];
  for (const c of out.claims) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    claims.push({
      id: c.id, text: c.text, skillIds: c.skillIds.filter((s) => skillIds.has(s)),
      source: { kind: c.source.kind, quote: c.source.quote, ...(c.source.page != null ? { page: c.source.page } : {}), ...(c.source.url ? { url: c.source.url } : {}) },
    });
  }
  const keep = (ids: string[]) => ids.filter((x) => seen.has(x));
  const pageUrls = new Set(pages.map((p) => p.url));
  return {
    headline: out.headline,
    claims,
    timeline: out.timeline.map((t) => ({ ...t, claimIds: keep(t.claimIds) })),
    flags: out.flags.map((f) => ({ ...f, claimIds: keep(f.claimIds) })),
    github,
    webFindings: out.webFindings.filter((w) => pageUrls.has(w.url)),
  };
}
