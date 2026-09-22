export function AuthFrame({
  quote,
  detail,
  footer,
  children,
}: {
  quote: string;
  detail: string;
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink px-12 py-12 text-paper lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-paper/20">
            <span className="h-3 w-3 rounded-full border border-paper" />
          </span>
          <span className="text-sm font-medium">Aperture</span>
        </div>
        <div>
          <p className="max-w-sm text-2xl font-medium leading-snug tracking-tight">{quote}</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-paper/60">{detail}</p>
        </div>
        <p className="text-xs text-paper/40">{footer}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
