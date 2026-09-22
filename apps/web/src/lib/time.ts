export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function formatRelative(date: Date): string {
  const delta = date.getTime() - Date.now();
  const abs = Math.abs(delta);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < hour) return rtf.format(Math.round(delta / minute), "minute");
  if (abs < day) return rtf.format(Math.round(delta / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(delta / day), "day");
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function typeLabel(type: string): string {
  return type.replaceAll("_", " ").toLowerCase();
}
