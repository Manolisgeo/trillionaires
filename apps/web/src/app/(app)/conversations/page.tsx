import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { formatDuration, formatRelative, typeLabel } from "@/lib/time";
import type { ConversationStatus, ConversationType } from "@kimma/database";
import type { Metadata } from "next";
import { cn } from "@kimma/ui";

export const metadata: Metadata = { title: "Conversations" };

const statuses: Array<{ id: "" | ConversationStatus; label: string }> = [
  { id: "", label: "All" },
  { id: "LIVE", label: "Live" },
  { id: "PROCESSING", label: "Processing" },
  { id: "COMPLETED", label: "Completed" },
  { id: "DRAFT", label: "Draft" },
];

const types: Array<{ id: "" | ConversationType; label: string }> = [
  { id: "", label: "All types" },
  { id: "INTERVIEW", label: "Interview" },
  { id: "SALES", label: "Sales" },
  { id: "RESEARCH", label: "Research" },
  { id: "EXPERT_INTERVIEW", label: "Expert" },
  { id: "MEETING", label: "Meeting" },
];

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const org = await requireOrg();
  const params = await searchParams;
  const status = statuses.some((item) => item.id && item.id === params.status)
    ? (params.status as ConversationStatus)
    : undefined;
  const type = types.some((item) => item.id && item.id === params.type)
    ? (params.type as ConversationType)
    : undefined;

  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId: org.organizationId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Conversations"
        description="Interviews, sales, research, meetings — one model."
        actions={
          <Link href="/conversations/new">
            <Button>New conversation</Button>
          </Link>
        }
      />
      <div className="mt-8 flex flex-wrap gap-4">
        <FilterRow
          items={statuses}
          param="status"
          current={status ?? ""}
          otherKey="type"
          otherValue={type ?? ""}
        />
        <FilterRow
          items={types}
          param="type"
          current={type ?? ""}
          otherKey="status"
          otherValue={status ?? ""}
        />
      </div>
      {conversations.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={status || type ? "Nothing matches these filters" : "Create the first conversation"}
            description={
              status || type
                ? "Clear the filters to see every conversation in this organization."
                : "Define the purpose and objectives. The AI participant will follow the state of the conversation, not a list of scripted questions."
            }
            action={
              <Link href="/conversations/new">
                <Button>New conversation</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 divide-y divide-line border-y border-line">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/conversations/${conversation.id}`}
              className="grid grid-cols-1 items-center gap-2 py-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-6"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{conversation.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted">{conversation.purpose}</div>
              </div>
              <div className="text-xs uppercase tracking-wide text-muted">
                {typeLabel(conversation.type)}
              </div>
              <div className="text-xs text-muted">{formatRelative(conversation.createdAt)}</div>
              <div className="text-xs tabular-nums text-muted">
                {formatDuration(conversation.durationSeconds)}
              </div>
              <StatusBadge status={conversation.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  items,
  param,
  current,
  otherKey,
  otherValue,
}: {
  items: Array<{ id: string; label: string }>;
  param: string;
  current: string;
  otherKey: string;
  otherValue: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => {
        const href = queryHref({ [param]: item.id, [otherKey]: otherValue });
        const active = current === item.id;
        return (
          <Link
            key={item.id || "all"}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              active ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink/40",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function queryHref(values: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const q = params.toString();
  return q ? `/conversations?${q}` : "/conversations";
}
