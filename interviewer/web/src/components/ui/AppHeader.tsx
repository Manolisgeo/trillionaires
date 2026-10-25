import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface HeaderNavItem {
  href: string;
  label: string;
  current?: boolean;
}

/** Hollinger bar. Slots: `nav` (main navigation), `title` (call number + subject), `steps` (centered phase clock), `readouts` (right). */
export function AppHeader({
  nav,
  title,
  steps,
  readouts,
  className,
}: {
  nav?: ReactNode;
  title?: ReactNode;
  steps?: ReactNode;
  readouts?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex min-h-14 flex-wrap items-center gap-x-6 gap-y-0 bg-hollinger px-4 text-white sm:px-7", className)}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-0 sm:flex-1 sm:basis-80">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold tracking-[0.14em] text-white no-underline hover:text-white">
          APERTURE
        </Link>
        {nav}
        {title ? <span className="font-mono text-sm text-rule-strong">{title}</span> : null}
      </div>
      {steps ? <div className="font-mono text-sm tracking-[0.04em] text-white">{steps}</div> : null}
      {readouts ? <div className="flex items-center justify-end gap-2.5 py-1 sm:flex-1 sm:basis-80">{readouts}</div> : null}
    </header>
  );
}

export function HeaderNav({ items, label = "Main" }: { items: HeaderNavItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-x-5 text-sm">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.current ? "page" : undefined}
          className={cx(
            "inline-flex min-h-14 items-center no-underline hover:text-white",
            it.current ? "font-semibold text-white shadow-[inset_0_-2px_0_#fff]" : "text-chrome-link",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
