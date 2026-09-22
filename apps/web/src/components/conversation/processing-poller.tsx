"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ProcessingPoller({
  conversationId,
  active,
}: {
  conversationId: string;
  active: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.status === "COMPLETED" || data.reportStatus === "COMPLETED") {
        router.refresh();
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [active, conversationId, router]);

  return null;
}
