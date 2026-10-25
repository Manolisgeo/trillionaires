import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

interface FieldMeta {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

const control =
  "w-full rounded-md border bg-card px-3 text-[15px] text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-board disabled:opacity-60";

function Shell({ id, label, hint, error, children, className }: FieldMeta & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="m-0 text-[13px] font-semibold text-[#A8322A]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describe = (id: string, hint: ReactNode, error: ReactNode) =>
  [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;

export function Input({ label, hint, error, className, id: given, ...rest }: FieldMeta & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describe(id, hint, error)} className={cx(control, "min-h-11", error ? "border-[#A8322A]" : "border-rule-strong")} {...rest} />
    </Shell>
  );
}

export function Textarea({ label, hint, error, className, id: given, rows = 6, ...rest }: FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={describe(id, hint, error)} className={cx(control, "py-2.5 leading-6", error ? "border-[#A8322A]" : "border-rule-strong")} {...rest} />
    </Shell>
  );
}

export function FileInput({ label, hint, error, className, id: given, ...rest }: FieldMeta & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        type="file"
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, hint, error)}
        className={cx(
          control,
          "min-h-11 cursor-pointer border-dashed py-1.5 text-sm text-ink-2 file:mr-3 file:min-h-8 file:cursor-pointer file:rounded file:border file:border-rule-strong file:bg-board file:px-3 file:text-sm file:font-semibold file:text-ink",
          error ? "border-[#A8322A]" : "border-rule-strong",
        )}
        {...rest}
      />
    </Shell>
  );
}

/** Checkbox with a real label, 44px row. */
export function Checkbox({ label, className, id: given, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-1 size-5 flex-none cursor-pointer" {...rest} />
      <label htmlFor={id} className="min-h-6 cursor-pointer text-sm leading-6 text-ink">
        {label}
      </label>
    </div>
  );
}
