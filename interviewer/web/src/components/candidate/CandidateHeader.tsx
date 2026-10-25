import { AppHeader } from "@/components/ui";

const STEPS = ["Your documents", "Review your record", "Interview"] as const;

/** Header for the candidate flow. `step` is 1-based. */
export function CandidateHeader({ step, company, tag }: { step: 1 | 2 | 3; company?: string; tag?: string }) {
  const title = [tag, company ? `for ${company}` : null].filter(Boolean).join(" · ");
  return (
    <AppHeader
      title={title || undefined}
      steps={
        <ol aria-label="Steps" className="m-0 flex list-none flex-wrap gap-x-5 p-0 font-sans text-sm tracking-normal">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const current = n === step;
            const done = n < step;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={current ? "py-3 font-semibold text-white shadow-[inset_0_-2px_0_#fff]" : "py-3 text-chrome-link"}
              >
                {n} · {label}
                {done ? <span className="sr-only"> (done)</span> : null}
                {done ? <span aria-hidden="true"> ✓</span> : null}
              </li>
            );
          })}
        </ol>
      }
    />
  );
}
