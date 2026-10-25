import type { ReactNode } from "react";
import { AppHeader, HeaderNav } from "@/components/ui";

/** The one recruiter navigation: every recruiter page (catalog, role, interview, report) uses this set. */
export function RecruiterHeader({ current }: { current: "catalog" | "new-role" | "none" }) {
  return (
    <AppHeader
      nav={
        <HeaderNav
          items={[
            { href: "/", label: "Catalog", current: current === "catalog" },
            { href: "/roles/new", label: "New role", current: current === "new-role" },
          ]}
        />
      }
    />
  );
}

export function RecruiterShell({ current, children, maxWidth = 1280 }: { current: "catalog" | "new-role" | "none"; children: ReactNode; maxWidth?: number }) {
  return (
    <>
      <RecruiterHeader current={current} />
      <main className="mx-auto flex w-full flex-col gap-6 px-4 pt-8 pb-14 sm:px-7" style={{ maxWidth }}>
        {children}
      </main>
    </>
  );
}

/** The heading carries itself. `tag` (a call number) sits on the heading's baseline, to its right, never above it. */
export function PageTitle({ tag, title, actions }: { tag?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="m-0 text-[30px] leading-[38px] font-bold text-balance">{title}</h1>
        {tag ? <span className="font-mono text-[13px] tracking-[0.04em] text-muted">{tag}</span> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
