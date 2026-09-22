"use client";

import { grantConsentAction } from "@/actions/conversation";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

export function ConsentButton({ conversationId }: { conversationId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => start(() => grantConsentAction(conversationId))}
    >
      {pending ? "Saving…" : "I understand and consent"}
    </Button>
  );
}
