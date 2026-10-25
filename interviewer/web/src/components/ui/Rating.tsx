import { cx } from "./cx";

/** 1–4 boxes. Suggested filled violet; 4 is dashed because only a person can award it. */
export function RatingScale({ rating, label }: { rating: 1 | 2 | 3 | null; label?: string }) {
  const aria = label ?? (rating ? `Suggested rating ${rating} of 4` : "No rating suggested: insufficient evidence");
  return (
    <span role="img" aria-label={aria} className="inline-flex gap-1">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={cx(
            "inline-flex size-7 items-center justify-center font-mono text-sm",
            n === 4 ? "border border-dashed border-rule-strong text-muted" : "border border-rule-strong text-muted",
            rating === n && "border-stamp bg-stamp font-bold text-white",
          )}
        >
          {n}
        </span>
      ))}
    </span>
  );
}
