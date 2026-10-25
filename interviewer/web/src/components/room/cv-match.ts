/**
 * Finds a quote in PDF.js text content. The text layer breaks lines mid-sentence, hyphenates, uses ligatures and
 * curly punctuation, so matching runs on a letters-and-digits-only stream with a map back to (item, char).
 */
export interface TextItemLike {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
}

export interface QuoteMatch {
  /** 1-based page. */
  page: number;
  /** itemIndex -> [start, end) character range to mark inside that item. */
  ranges: Map<number, [number, number]>;
  /** Line number on the page (1-based, top to bottom) of the first matched item, when positions are known. */
  line: number | null;
  firstItem: number;
}

const KEEP = /[\p{L}\p{N}]/u;

interface Stream {
  text: string;
  item: number[];
  ch: number[];
}

function buildStream(items: TextItemLike[]): Stream {
  let text = "";
  const item: number[] = [];
  const ch: number[] = [];
  items.forEach((it, i) => {
    const s = it.str ?? "";
    for (let c = 0; c < s.length; c++) {
      for (const f of s[c].normalize("NFKD")) {
        if (!KEEP.test(f)) continue;
        text += f.toLowerCase();
        item.push(i);
        ch.push(c);
      }
    }
  });
  return { text, item, ch };
}

export const foldQuote = (q: string): string => {
  let out = "";
  for (const c of q) for (const f of c.normalize("NFKD")) if (KEEP.test(f)) out += f.toLowerCase();
  return out;
};

function lineNumber(items: TextItemLike[], itemIndex: number): number | null {
  const ys: number[] = [];
  let target: number | null = null;
  items.forEach((it, i) => {
    if (!it.str.trim() || !it.transform) return;
    const y = Math.round(it.transform[5] / 3) * 3;
    if (!ys.includes(y)) ys.push(y);
    if (i === itemIndex) target = y;
  });
  if (target == null) return null;
  ys.sort((a, b) => b - a); // PDF y grows upward
  return ys.indexOf(target) + 1;
}

export interface LineRow {
  /** 1-based, top to bottom: the same numbering `QuoteMatch.line` uses, so "line 4" on the card is the 4 in the gutter. */
  n: number;
  /** Baseline in PDF units (y grows upward). */
  y: number;
  /** Largest glyph height on the row, PDF units. */
  size: number;
}

/** One row per distinct text baseline on a page, numbered exactly like `lineNumber`. */
export function lineRows(items: TextItemLike[]): LineRow[] {
  const rows = new Map<number, { y: number; size: number }>();
  for (const it of items) {
    if (!it.str.trim() || !it.transform) continue;
    const key = Math.round(it.transform[5] / 3) * 3;
    const size = Math.abs(it.transform[3]) || 10;
    const cur = rows.get(key);
    if (!cur) rows.set(key, { y: it.transform[5], size });
    else cur.size = Math.max(cur.size, size);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, v], i) => ({ n: i + 1, y: v.y, size: v.size }));
}

function locate(stream: Stream, needle: string): [number, number] | null {
  if (needle.length < 8) return null;
  const at = stream.text.indexOf(needle);
  return at >= 0 ? [at, at + needle.length] : null;
}

/** Tries the whole quote first, then its leading / trailing 70% (quotes are often trimmed or lightly reworded). */
function findInStream(stream: Stream, folded: string): [number, number] | null {
  const whole = locate(stream, folded);
  if (whole) return whole;
  const cut = Math.floor(folded.length * 0.7);
  if (cut < 14) return null;
  return locate(stream, folded.slice(0, cut)) ?? locate(stream, folded.slice(folded.length - cut));
}

export function findQuote(pages: TextItemLike[][], quote: string, hintPage?: number): QuoteMatch | null {
  const folded = foldQuote(quote);
  if (!folded) return null;
  const order = pages.map((_, i) => i + 1);
  if (hintPage && hintPage >= 1 && hintPage <= pages.length) order.sort((a, b) => (a === hintPage ? -1 : b === hintPage ? 1 : a - b));
  for (const page of order) {
    const items = pages[page - 1];
    const stream = buildStream(items);
    const hit = findInStream(stream, folded);
    if (!hit) continue;
    const ranges = new Map<number, [number, number]>();
    for (let k = hit[0]; k < hit[1]; k++) {
      const it = stream.item[k];
      const c = stream.ch[k];
      const cur = ranges.get(it);
      if (!cur) ranges.set(it, [c, c + 1]);
      else ranges.set(it, [Math.min(cur[0], c), Math.max(cur[1], c + 1)]);
    }
    const firstItem = stream.item[hit[0]];
    return { page, ranges, line: lineNumber(items, firstItem), firstItem };
  }
  return null;
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML for one text item: the whole string, with the matched slice wrapped in a slip highlight. */
export function markedHtml(str: string, range: [number, number] | undefined): string {
  if (!range) return escapeHtml(str);
  const [a, b] = range;
  return `${escapeHtml(str.slice(0, a))}<mark class="slip-mark">${escapeHtml(str.slice(a, b))}</mark>${escapeHtml(str.slice(b))}`;
}

/** Preview only: a readable line from page 1, used when the scripted quote is not in this particular CV. */
export function pickDemoLine(pages: TextItemLike[][]): string | null {
  const lines = new Map<number, string[]>();
  for (const it of pages[0] ?? []) {
    if (!it.str.trim() || !it.transform) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    const row = lines.get(y);
    if (row) row.push(it.str);
    else lines.set(y, [it.str]);
  }
  const text = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v.join(" ").replace(/\s+/g, " ").trim());
  return text.find((l, i) => i >= 3 && l.length >= 40 && l.length <= 140) ?? text.find((l) => l.length >= 40) ?? null;
}
