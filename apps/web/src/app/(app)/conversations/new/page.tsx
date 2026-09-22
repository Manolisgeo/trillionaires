import { CreateConversationForm } from "@/components/conversation/create-form";
import { PageHeader } from "@/components/shell/page-header";
import type { ConversationType } from "@aperture/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New conversation" };

export default async function NewConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const type = params.type as ConversationType | undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New conversation"
        description="Define the purpose and objectives. The AI participant works from this state, not a script."
      />
      <div className="mt-10">
        <CreateConversationForm defaultType={type} />
      </div>
    </div>
  );
}
