"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { useT } from "@/i18n/LanguageProvider";
import type { DepositStatus } from "@/lib/status";

/* ------------------------------------------------------------------ button */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/50 shadow-sm",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-50",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50",
  danger:
    "bg-st-overdue text-white hover:opacity-90 disabled:opacity-50 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------- card */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- status badge */

const STATUS_STYLES: Record<DepositStatus, string> = {
  active: "bg-st-active-bg text-st-active",
  due_today: "bg-st-due-bg text-st-due",
  paid: "bg-st-paid-bg text-st-paid",
  overdue: "bg-st-overdue-bg text-st-overdue",
};

const STATUS_LABEL = {
  active: "status.active",
  due_today: "status.due_today",
  paid: "status.paid",
  overdue: "status.overdue",
} as const;

export function StatusBadge({
  status,
  className = "",
}: {
  status: DepositStatus;
  className?: string;
}) {
  const t = useT();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status]} ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {t(STATUS_LABEL[status])}
    </span>
  );
}

/* ------------------------------------------------------------- page heading */

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- key/value */

export function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`tnum text-right text-sm ${
          emphasis ? "text-base font-semibold" : "font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------- empty state */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-lg text-accent"
      >
        ⌗
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hint}</p>
      </div>
      {action}
    </div>
  );
}
