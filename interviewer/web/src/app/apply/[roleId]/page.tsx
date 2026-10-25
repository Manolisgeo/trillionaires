import type { Metadata } from "next";
import { CandidateHeader } from "@/components/candidate/CandidateHeader";
import { ApplyForm } from "@/components/candidate/ApplyForm";
import { ButtonLink, DemoLabel, EmptyState } from "@/components/ui";
import { callNo } from "@/lib/format";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply · Kimma" };

export default async function ApplyPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const role = await store.roles.get(roleId);

  if (!role || role.status !== "approved") {
    return (
      <>
        <CandidateHeader step={1} company={role?.company} />
        <main className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-7">
          <EmptyState
            title={role ? "This role is not open for applications yet" : "We couldn't find this role"}
            action={<ButtonLink href="/" variant="secondary">Go to the home page</ButtonLink>}
          >
            {role
              ? `${role.company} has not approved the interview for ${role.title} yet. Please check back later or ask the person who sent you this link.`
              : "The link may be incomplete or out of date. Ask the person who sent it to you for a fresh link."}
          </EmptyState>
        </main>
      </>
    );
  }

  return (
    <>
      <CandidateHeader step={1} company={role.company} tag={`${callNo.role(role.id)} · ${role.title}`} />
      <main className="mx-auto w-full max-w-[760px] px-4 pt-9 pb-14 sm:px-7">
        <div className="flex max-w-[64ch] flex-col gap-2.5">
          <h1 className="m-0 text-balance text-[30px] leading-[38px] font-bold">Tell us about yourself, then talk with an AI interviewer.</h1>
          <p className="m-0 text-base leading-[25px] text-ink-2">
            Upload your CV and share any links you like. Before the interview you will see everything we read and can remove or correct it.
          </p>
          {role.demoData ? <DemoLabel className="mt-1" /> : null}
        </div>
        <ApplyForm roleId={role.id} role={role.title} company={role.company} />
      </main>
    </>
  );
}
