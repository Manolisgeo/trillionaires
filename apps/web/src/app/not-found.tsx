import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          That conversation, report, or route does not exist in this workspace.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
