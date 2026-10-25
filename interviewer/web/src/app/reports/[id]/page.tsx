import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { RecruiterHeader } from "@/components/recruiter/Shell";
import { Processing } from "@/components/report/Processing";
import { ReportView } from "@/components/report/ReportView";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finding aid · Aperture" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const interview = await store.interviews.get(id);
  if (!interview) notFound();
  const [role, candidate] = await Promise.all([store.roles.get(interview.roleId), store.candidates.get(interview.candidateId)]);

  const header = <RecruiterHeader current="none" />;

  return (
    <div className="flex min-h-screen flex-col">
      {header}
      {!role || !candidate ? (
        <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-7">
          <EmptyState title="This record is incomplete.">The role or candidate for this interview is missing from the store.</EmptyState>
        </div>
      ) : interview.report ? (
        <ReportView interview={interview} role={role} candidate={candidate} report={interview.report} />
      ) : (
        <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-7">
          <h1 className="m-0 mb-5 text-[26px] leading-[34px] font-bold">
            {candidate.name} <span className="font-normal text-muted">— {role.title}</span>
          </h1>
          <Processing id={id} status={interview.status} />
        </div>
      )}
    </div>
  );
}
