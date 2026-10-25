import { CatalogCard } from "@/components/ui";
import type { ResolvedQuestion } from "./deskState";

/** The catalog card: what is being asked, why, and where it comes from. */
export function QuestionCard({ text, kind, resolved, source }: { text: string | null; kind: "core" | "probe" | null; resolved: ResolvedQuestion | null; source: string | null }) {
  if (!text || !resolved) {
    return (
      <CatalogCard dashed kicker="NO QUESTION YET" right="ASKED BY APERTURE (AI)" aria-label="Current question">
        <p className="m-0 max-w-[62ch] text-[17px] leading-7 text-ink-2">Each question appears here, in full, as Aperture asks it. Nothing is asked that you cannot read.</p>
      </CatalogCard>
    );
  }
  const parts = [resolved.phaseShort, resolved.criterion?.toUpperCase(), (kind ?? "core").toUpperCase()].filter(Boolean).join(" · ");
  return (
    <CatalogCard
      ruled="strips"
      aria-label="Current question"
      kicker={
        <>
          <span key={resolved.tag} className="stamp-press inline-block origin-left">
            {resolved.tag}
          </span>
          {" · "}
          {parts}
        </>
      }
      right="ASKED BY APERTURE (AI)"
    >
      {/* Rules live on the kicker and source rows only; the question sits between them on clean card, 12px clear of each rule. */}
      <p className="m-0 max-w-[62ch] py-3 text-xl leading-6 font-medium text-balance">{text}</p>
      {source ? <div className="ruled font-mono text-[13px] leading-6 text-muted">{source}</div> : null}
    </CatalogCard>
  );
}
