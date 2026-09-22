import { builtinTemplates } from "@aperture/conversation";
import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const org = await requireOrg();
  const custom = await prisma.conversationTemplate.findMany({
    where: { organizationId: org.organizationId, isBuiltin: false },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Templates"
        description="Starting configurations for a conversation type. They set objectives, not a rigid script."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {builtinTemplates.map((template) => (
          <div key={template.name} className="flex flex-col rounded-xl border border-line bg-white p-5">
            <div className="text-[11px] uppercase tracking-wide text-muted">{template.type.replaceAll("_", " ")}</div>
            <h2 className="mt-1 text-base font-medium">{template.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">{template.description}</p>
            <Link href={`/conversations/new?type=${template.type}`} className="mt-5">
              <Button variant="secondary" size="sm">
                Use template
              </Button>
            </Link>
          </div>
        ))}
        {custom.map((template) => (
          <div key={template.id} className="rounded-xl border border-line bg-white p-5">
            <div className="text-[11px] uppercase tracking-wide text-muted">{template.type}</div>
            <h2 className="mt-1 text-base font-medium">{template.name}</h2>
            <p className="mt-2 text-sm text-muted">{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
