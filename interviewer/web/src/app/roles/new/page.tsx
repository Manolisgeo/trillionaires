import { NewRoleForm } from "@/components/recruiter/NewRoleForm";
import { PageTitle, RecruiterShell } from "@/components/recruiter/Shell";

export const metadata = { title: "New role · Kimma" };

export default function NewRolePage() {
  return (
    <RecruiterShell current="new-role" maxWidth={880}>
      <PageTitle title="New role from a job description" />
      <NewRoleForm />
    </RecruiterShell>
  );
}
