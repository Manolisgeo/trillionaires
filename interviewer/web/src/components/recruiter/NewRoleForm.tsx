"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorNote, Input, Textarea } from "@/components/ui";
import { api } from "@/lib/client";

export function NewRoleForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const role = await api.roles.create({ title: title.trim(), company: company.trim(), jdText: jd.trim() });
      router.push(`/roles/${role.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not create the role");
      setBusy(false);
    }
  }

  const short = jd.trim().length > 0 && jd.trim().length < 20;
  return (
    <form onSubmit={submit} className="flex flex-col gap-6 border border-rule border-t-[3px] border-t-redline bg-card px-5 py-6 sm:px-7">
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Role title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Customer Success Lead" />
        <Input label="Company" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Northwind" />
      </div>
      <Textarea
        label="Job description"
        hint="Paste the full text. Aperture drafts competencies, anchors and core questions from it; you review everything before approval."
        required
        rows={14}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        error={short ? "The job description needs at least 20 characters." : undefined}
      />
      {err ? <ErrorNote title="The role was not created">{err}</ErrorNote> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" busy={busy} disabled={!title.trim() || !company.trim() || jd.trim().length < 20}>
          {busy ? "Sending to the cataloguer" : "Draft the rubric"}
        </Button>
        <span className="text-[13px] text-muted">Drafting takes under a minute. The draft is never shown to candidates until you approve it.</span>
      </div>
    </form>
  );
}
