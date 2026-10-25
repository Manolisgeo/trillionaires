"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteConversationAction } from "@/actions/conversation";
import { Button } from "@/components/ui/button";

export function ConversationToolbar({
  conversationId,
  title,
  canDelete,
  transcript,
  report,
}: {
  conversationId: string;
  title: string;
  canDelete: boolean;
  transcript: Array<{ speakerName: string; startTime: number; text: string }>;
  report: { summary: string | null; sections: Array<{ title: string; body: string; kind?: string | null }> } | null;
}) {
  const [pending, start] = useTransition();

  function download(filename: string, body: string, type: string) {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportTranscript() {
    if (transcript.length === 0) {
      toast.error("No transcript to export.");
      return;
    }
    const text = transcript
      .map((row) => {
        const m = Math.floor(row.startTime / 60)
          .toString()
          .padStart(2, "0");
        const s = Math.floor(row.startTime % 60)
          .toString()
          .padStart(2, "0");
        return `[${m}:${s}] ${row.speakerName}: ${row.text}`;
      })
      .join("\n\n");
    download(`${slug(title)}-transcript.txt`, text, "text/plain;charset=utf-8");
    toast.success("Transcript downloaded.");
  }

  function exportReport() {
    if (!report) {
      toast.error("Report is not ready yet.");
      return;
    }
    const parts = [`# ${title}`, ""];
    if (report.summary) parts.push("## Executive summary", report.summary, "");
    for (const section of report.sections) {
      parts.push(`## ${section.title}${section.kind ? ` (${section.kind})` : ""}`, section.body, "");
    }
    parts.push("_Kimma produces evidence. Humans make irreversible decisions._");
    download(`${slug(title)}-report.md`, parts.join("\n"), "text/markdown;charset=utf-8");
    toast.success("Report downloaded.");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied.");
  }

  return (
    <div className="print:hidden flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" type="button" onClick={copyLink}>
        Copy link
      </Button>
      <Button variant="secondary" size="sm" type="button" onClick={exportTranscript}>
        Transcript
      </Button>
      <Button variant="secondary" size="sm" type="button" onClick={exportReport}>
        Report
      </Button>
      {report ? (
        <Button variant="secondary" size="sm" type="button" onClick={() => window.print()}>
          Print
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Delete this conversation and its transcript, report, and recordings for this organization?",
              )
            ) {
              return;
            }
            start(async () => {
              await deleteConversationAction(conversationId);
            });
          }}
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "conversation"
  );
}
