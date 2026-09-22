import { logoutAction } from "@/actions/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { CommandPalette } from "@/components/shell/command-palette";

export function AppShell({
  children,
  userName,
  orgName,
}: {
  children: React.ReactNode;
  userName: string;
  orgName: string;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="print:hidden sticky top-0 z-20 border-b border-line bg-white px-5 py-5 lg:h-screen lg:border-b-0 lg:border-r">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink">
            <span className="h-3 w-3 rounded-full border border-paper" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold leading-none tracking-tight">Aperture</span>
            <span className="mt-1 block text-[11px] text-muted">{orgName}</span>
          </span>
        </Link>
        <SidebarNav />
        <form action={logoutAction} className="mt-8 flex items-center justify-between gap-3 lg:mt-10 lg:block">
          <div className="truncate text-xs text-muted">{userName}</div>
          <Button variant="secondary" size="sm" type="submit" className="lg:mt-3">
            Sign out
          </Button>
        </form>
        <p className="mt-6 hidden text-[11px] text-muted lg:block">⌘K to search or jump</p>
      </aside>
      <main className="min-w-0 px-6 py-8 lg:px-12 lg:py-10 print:px-0 print:py-0">{children}</main>
      <CommandPalette />
    </div>
  );
}
