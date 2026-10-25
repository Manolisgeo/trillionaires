"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

export function PrepareInterviewButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const iv = await api.interviews.create(candidateId);
      router.push(`/interviews/${iv.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not prepare the interview");
      setBusy(false);
    }
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <Button variant="secondary" size={40} busy={busy} onClick={go}>
        {busy ? "Preparing" : "Prepare interview"}
      </Button>
      {err ? (
        <span role="alert" className="text-[13px] font-semibold text-[#A8322A]">
          {err}
        </span>
      ) : null}
    </span>
  );
}
