/** Seconds -> "mm:ss" (or "h:mm:ss" past an hour). */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable call numbers derived from ids, e.g. R-014, C-0388, KM-2026.0142. */
export const callNo = {
  role: (id: string) => `R-${String(hash(id) % 1000).padStart(3, "0")}`,
  candidate: (id: string) => `C-${String(hash(id) % 10000).padStart(4, "0")}`,
  interview: (id: string, createdAt?: string) => {
    const year = createdAt ? new Date(createdAt).getUTCFullYear() : new Date().getUTCFullYear();
    return `KM-${year}.${String(hash(id) % 10000).padStart(4, "0")}`;
  },
  /** Question call tag, e.g. Q2.3 from phase index (1-based) and question index (1-based). */
  question: (phaseIndex: number, n: number) => `Q${phaseIndex}.${n}`,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
export const roman = (n: number): string => ROMAN[n - 1] ?? String(n);

const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
/** "25 Oct 2026" (UTC, so server and client agree). */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}
const DATETIME = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
export function formatDateTime(iso: string): string {
  return `${DATETIME.format(new Date(iso))} UTC`;
}

export function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

/**
 * Interview length for display: startedAt/endedAt when they give a positive span, else the end of the last transcript
 * segment. Null when neither is known; never "0 min".
 */
export function interviewDuration(i: { startedAt: string | null; endedAt: string | null; transcript: { end: number }[] }): string | null {
  const stamped = i.startedAt && i.endedAt ? (new Date(i.endedAt).getTime() - new Date(i.startedAt).getTime()) / 1000 : 0;
  const lastEnd = i.transcript.reduce((m, s) => Math.max(m, s.end), 0);
  const sec = stamped >= 30 ? stamped : lastEnd;
  if (!(sec > 0)) return null;
  const min = Math.round(sec / 60);
  return min >= 1 ? `${min} min` : "under 1 min";
}
