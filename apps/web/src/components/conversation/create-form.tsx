"use client";

import { useMemo, useState } from "react";
import { builtinTemplates } from "@aperture/conversation";
import type { ConversationType } from "@aperture/types";
import { createConversationAction } from "@/actions/conversation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@aperture/ui";

const types: ConversationType[] = [
  "INTERVIEW",
  "SALES",
  "RESEARCH",
  "EXPERT_INTERVIEW",
  "MEETING",
  "CUSTOM",
];

function labelFor(type: ConversationType): string {
  return type.replaceAll("_", " ").toLowerCase();
}

export function CreateConversationForm({ defaultType }: { defaultType?: ConversationType }) {
  const initial = defaultType && types.includes(defaultType) ? defaultType : "INTERVIEW";
  const [type, setType] = useState<ConversationType>(initial);
  const template = useMemo(
    () => builtinTemplates.find((item) => item.type === type),
    [type],
  );

  return (
    <form action={createConversationAction} className="space-y-8">
      <div>
        <p className="text-sm font-medium">Conversation type</p>
        <p className="mt-1 text-xs text-muted">
          Same infrastructure. Different objectives. The agent will not follow a rigid script.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {types.map((value) => {
            const match = builtinTemplates.find((item) => item.type === value);
            return (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-xl border bg-white p-4 transition-colors",
                  type === value ? "border-ink" : "border-line hover:border-ink/40",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                  className="sr-only"
                />
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  {labelFor(value)}
                </div>
                <div className="mt-1 text-sm font-medium">{match?.name ?? "Custom"}</div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {match?.description ?? "Define your own purpose and objectives."}
                </p>
              </label>
            );
          })}
        </div>
      </div>

      <Field label="Title">
        <Input name="title" required defaultValue={template?.name ?? ""} key={`${type}-title`} />
      </Field>
      <Field label="Purpose" hint="What this conversation is trying to establish.">
        <Textarea
          name="purpose"
          required
          key={`${type}-purpose`}
          defaultValue={template?.purpose ?? ""}
        />
      </Field>
      <Field label="Objectives" hint="One per line. These drive follow-ups and the report.">
        <Textarea
          name="objectives"
          required
          key={`${type}-objectives`}
          defaultValue={template?.objectives.map((item) => item.title).join("\n") ?? ""}
        />
      </Field>
      <Field label="Primary participant">
        <Input name="participantName" required placeholder="Alex Rivera" />
      </Field>
      <Button type="submit">Create conversation</Button>
    </form>
  );
}
