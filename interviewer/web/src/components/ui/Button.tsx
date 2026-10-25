import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = 40 | 44 | 48;

const VARIANT: Record<ButtonVariant, string> = {
  primary: "border border-ink bg-ink font-semibold text-white hover:border-ink-2 hover:bg-ink-2 hover:text-white",
  secondary: "border border-rule-strong bg-card text-ink hover:border-ink-2 hover:bg-board hover:text-ink",
  danger: "border border-ink-2 bg-card font-semibold text-ink hover:border-ink hover:bg-board hover:text-ink",
};
const SIZE: Record<ButtonSize, string> = {
  40: "min-h-10 px-4 text-sm",
  44: "min-h-11 px-[18px] text-sm",
  48: "min-h-12 px-[22px] text-[15px]",
};

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export function Button({
  variant = "primary",
  size = 44,
  className,
  type = "button",
  busy,
  children,
  disabled,
  ...rest
}: Common & { busy?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(base, VARIANT[variant], SIZE[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Same look, rendered as a link. */
export function ButtonLink({ variant = "primary", size = 44, className, href, children }: Common & { href: string }) {
  return (
    <Link href={href} className={cx(base, VARIANT[variant], SIZE[size], className)}>
      {children}
    </Link>
  );
}

/** Round icon-only button (48px mic, 44px play). Requires aria-label. */
export function IconButton({
  size = 48,
  className,
  children,
  ...rest
}: { size?: 44 | 48; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex cursor-pointer items-center justify-center rounded-full border-0 bg-ink text-white transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === 48 ? "size-12" : "size-11",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
