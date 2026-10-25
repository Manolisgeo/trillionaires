import Exa from "exa-js";
import { env, has } from "../env";
import type { Candidate, GithubSummary } from "../types";

interface GhRepo {
  name: string; html_url: string; description: string | null; language: string | null;
  stargazers_count: number; pushed_at: string; fork?: boolean;
}

/** GitHub REST: recent repos of a user. Returns null on any failure (research is best-effort). */
export async function fetchGithub(handle: string): Promise<GithubSummary | null> {
  const h = handle.replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").split("/")[0].trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(h)) return null;
  try {
    const res = await fetch(`https://api.github.com/users/${h}/repos?sort=pushed&per_page=12`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "aperture-interviewer",
        ...(has("GITHUB_TOKEN") ? { Authorization: `Bearer ${env("GITHUB_TOKEN")}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const repos = (await res.json()) as GhRepo[];
    const counts = new Map<string, number>();
    for (const r of repos) if (r.language && !r.fork) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    return {
      handle: h,
      repos: repos.map((r) => ({
        name: r.name, url: r.html_url, description: r.description, language: r.language,
        stars: r.stargazers_count, pushedAt: r.pushed_at,
      })),
      topLanguages: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l),
    };
  } catch {
    return null;
  }
}

/** Hostnames of the candidate's own links (+ github.com when a handle is given). LinkedIn is excluded: it blocks crawlers. */
export function linkDomains(c: Candidate): string[] {
  const set = new Set<string>();
  for (const l of c.links) {
    try {
      const host = new URL(/^https?:\/\//i.test(l) ? l : `https://${l}`).hostname.replace(/^www\./, "");
      if (host && !host.endsWith("linkedin.com")) set.add(host);
    } catch { /* ignore malformed link */ }
  }
  if (c.githubHandle) set.add("github.com");
  return [...set];
}

export interface WebPage { url: string; title: string; text: string }

/** Exa search restricted to the candidate's own domains. Skipped (empty) without EXA_API_KEY or domains. */
export async function searchOwnDomains(c: Candidate, roleTitle: string): Promise<WebPage[]> {
  const domains = linkDomains(c);
  if (!has("EXA_API_KEY") || domains.length === 0) return [];
  try {
    const exa = new Exa(env("EXA_API_KEY"));
    const res = await exa.search(`${c.name} projects, writing and work relevant to ${roleTitle}`, {
      numResults: 6,
      includeDomains: domains,
      contents: { text: { maxCharacters: 2500 } },
    });
    return res.results.map((r) => ({ url: r.url, title: r.title ?? r.url, text: r.text }));
  } catch {
    return [];
  }
}
