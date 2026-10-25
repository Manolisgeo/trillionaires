import type { Metadata } from "next";
import { CandidateHeader } from "@/components/candidate/CandidateHeader";
import { ReviewRecord } from "@/components/candidate/ReviewRecord";
import { ButtonLink, EmptyState } from "@/components/ui";
import { callNo } from "@/lib/format";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review your record · Kimma" };

export default async function ReviewPage({ params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const candidate = await store.candidates.get(candidateId);
  const role = candidate ? await store.roles.get(candidate.roleId) : null;

  if (!candidate || !role) {
    return (
      <>
        <CandidateHeader step={2} />
        <main className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-7">
          <EmptyState title="We couldn't find your record" action={<ButtonLink href="/" variant="secondary">Go to the home page</ButtonLink>}>
            The link may be incomplete. Use the application link you were sent to start again.
          </EmptyState>
        </main>
      </>
    );
  }
  return (
    <>
      <CandidateHeader step={2} company={role.company} tag={`${callNo.candidate(candidate.id)} · ${role.title}`} />
      <ReviewRecord initial={candidate} roleTitle={role.title} company={role.company} />
    </>
  );
}
