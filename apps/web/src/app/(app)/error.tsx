"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Error</p>
      <h1 className="mt-3 text-2xl font-medium tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {error.message || "The page could not be loaded. Try again."}
      </p>
      <Button className="mt-6" type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
