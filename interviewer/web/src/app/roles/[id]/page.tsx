import { notFound } from "next/navigation";
import { RoleEditor } from "@/components/recruiter/RoleEditor";
import { RecruiterShell } from "@/components/recruiter/Shell";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const role = await store.roles.get((await params).id);
  if (!role) notFound();
  return (
    <RecruiterShell current="none" maxWidth={1320}>
      <RoleEditor initial={role} />
    </RecruiterShell>
  );
}
