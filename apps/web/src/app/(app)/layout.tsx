import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await requireOrg();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: org.organizationId },
  });

  return (
    <AppShell userName={org.name} orgName={organization.name}>
      {children}
    </AppShell>
  );
}
