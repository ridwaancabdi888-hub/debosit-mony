"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCountdownText } from "@/components/Countdown";
import { CustomerForm } from "@/components/CustomerForm";
import { DeleteDialog } from "@/components/DeleteDialog";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";
import { useToday } from "@/components/TodayProvider";
import {
  CheckIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/icons";
import { Button, Card, EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { deriveStatus } from "@/lib/status";
import type { Deposit } from "@/lib/types";

/** Matches on name or phone number. */
function matches(deposit: Deposit, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (deposit.fullName.toLowerCase().includes(needle)) return true;
  if (deposit.phone.toLowerCase().includes(needle)) return true;

  // Digits-only fallback so "252611" still finds "+252 61 1234567".
  // Only for queries that contain no letters: otherwise the stray digits in a
  // name like "E2E" would reduce to "2" and match nearly every phone number.
  if (/\p{L}/u.test(needle)) return false;
  const needleDigits = needle.replace(/\D/g, "");
  return (
    needleDigits.length >= 3 &&
    deposit.phone.replace(/\D/g, "").includes(needleDigits)
  );
}

export function CustomersView({ deposits }: { deposits: Deposit[] }) {
  const { t, language } = useLanguage();
  const today = useToday();

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deposit | null>(null);
  const [payTarget, setPayTarget] = useState<Deposit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deposit | null>(null);

  const visible = useMemo(
    () => deposits.filter((deposit) => matches(deposit, query)),
    [deposits, query],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (deposit: Deposit) => {
    setEditing(deposit);
    setFormOpen(true);
  };

  const addButton = (
    <Button variant="primary" onClick={openAdd} className="w-full sm:w-auto">
      <PlusIcon />
      {t("customers.add")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={t("customers.title")}
        subtitle={t("customers.subtitle")}
        action={addButton}
      />

      {/* --------------------------------------------------------- search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-faint">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("customers.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-10 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm placeholder:text-faint"
          />
        </div>
        <p className="tnum shrink-0 text-xs text-muted">
          {query.trim()
            ? t("customers.showing", {
                count: visible.length,
                total: deposits.length,
              })
            : t("customers.total", { count: deposits.length })}
        </p>
      </div>

      {/* ---------------------------------------------------------- body */}
      {deposits.length === 0 ? (
        <Card>
          <EmptyState
            title={t("customers.empty")}
            hint={t("customers.emptyHint")}
            action={addButton}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title={t("customers.noResults")}
            hint={t("customers.noResultsHint", { query: query.trim() })}
            action={
              <Button variant="secondary" onClick={() => setQuery("")}>
                {t("customers.clearSearch")}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop / tablet-landscape: full table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-start">
                    <Th>{t("field.name")}</Th>
                    {/* The due date is the column this business runs on, so it
                        sits second and is styled to dominate the row. */}
                    <Th accent>{t("field.dueDate")}</Th>
                    <Th>{t("field.phone")}</Th>
                    <Th align="end">{t("field.deposit")}</Th>
                    <Th align="end">{t("field.duration")}</Th>
                    <Th>{t("field.depositDate")}</Th>
                    <Th align="end">{t("field.brokerFee")}</Th>
                    <Th align="end">{t("field.netReturn")}</Th>
                    <Th align="end">{t("field.profit")}</Th>
                    <Th>{t("field.status")}</Th>
                    <Th align="end">{t("common.actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((deposit) => (
                    <tr
                      key={deposit.id}
                      className="transition-colors hover:bg-surface-2"
                    >
                      <Td>
                        <Link
                          href={`/customers/${deposit.id}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {deposit.fullName}
                        </Link>
                      </Td>
                      <DueDateCell deposit={deposit} />
                      <Td className="tnum text-muted" dir="ltr">
                        {deposit.phone}
                      </Td>
                      <Td align="end" className="tnum font-semibold">
                        {formatCents(deposit.depositCents)}
                      </Td>
                      <Td align="end" className="tnum whitespace-nowrap text-muted">
                        {deposit.durationDays} {t("common.days")}
                      </Td>
                      <Td className="tnum whitespace-nowrap text-muted">
                        {formatDate(deposit.depositDate, language)}
                      </Td>
                      <Td align="end" className="tnum font-medium text-st-due">
                        - {formatCents(deposit.brokerFeeCents)}
                      </Td>
                      <Td align="end" className="tnum font-semibold">
                        {formatCents(deposit.netReturnCents)}
                      </Td>
                      <Td align="end" className="tnum font-semibold text-st-paid">
                        {formatCents(deposit.profitCents)}
                      </Td>
                      <Td>
                        <StatusBadge status={deriveStatus(deposit, today)} />
                      </Td>
                      <Td align="end">
                        <RowActions
                          deposit={deposit}
                          onEdit={() => openEdit(deposit)}
                          onPay={() => setPayTarget(deposit)}
                          onDelete={() => setDeleteTarget(deposit)}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Phones / tablets: the same rows as cards */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {visible.map((deposit) => (
              <li key={deposit.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${deposit.id}`}
                        className="truncate font-semibold hover:text-accent hover:underline"
                      >
                        {deposit.fullName}
                      </Link>
                      <p className="tnum truncate text-xs text-muted" dir="ltr">
                        {deposit.phone}
                      </p>
                    </div>
                    <StatusBadge status={deriveStatus(deposit, today)} />
                  </div>

                  {/* Due date gets its own highlighted band on small screens. */}
                  <DueDateBanner deposit={deposit} />

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <CardField
                      label={t("field.deposit")}
                      value={formatCents(deposit.depositCents)}
                    />
                    <CardField
                      label={t("field.duration")}
                      value={`${deposit.durationDays} ${t("common.days")}`}
                    />
                    <CardField
                      label={t("field.depositDate")}
                      value={formatDate(deposit.depositDate, language)}
                    />
                    <CardField
                      label={t("field.brokerFee")}
                      value={`- ${formatCents(deposit.brokerFeeCents)}`}
                      tone="fee"
                    />
                    <CardField
                      label={t("field.netReturn")}
                      value={formatCents(deposit.netReturnCents)}
                      strong
                    />
                    <CardField
                      label={t("field.profit")}
                      value={formatCents(deposit.profitCents)}
                      tone="profit"
                    />
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(deposit)}
                    >
                      <PencilIcon />
                      {t("common.edit")}
                    </Button>
                    {!deposit.paidAt && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setPayTarget(deposit)}
                      >
                        <CheckIcon />
                        {t("action.markPaid")}
                      </Button>
                    )}
                    <Link
                      href={`/customers/${deposit.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <EyeIcon />
                      {t("action.viewDetails")}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(deposit)}
                      className="ms-auto text-st-overdue hover:bg-st-overdue-bg"
                      aria-label={t("common.delete")}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* -------------------------------------------------------- dialogs */}
      {formOpen && (
        <CustomerForm
          open
          deposit={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      <MarkPaidDialog
        deposit={payTarget}
        onClose={() => setPayTarget(null)}
      />
      <DeleteDialog
        deposit={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- due date */

const DUE_TONE = {
  active: "text-accent",
  due: "text-st-due",
  paid: "text-st-paid",
  overdue: "text-st-overdue",
} as const;

/** Prominent due-date cell: large, accent-tinted, with the countdown beneath. */
function DueDateCell({ deposit }: { deposit: Deposit }) {
  const { language } = useLanguage();
  const { text, tone } = useCountdownText(deposit);

  return (
    <td className="border-x border-line bg-accent-soft/50 px-3 py-3">
      <p className="tnum text-base leading-tight font-bold whitespace-nowrap text-ink">
        {formatDate(deposit.dueDate, language)}
      </p>
      <p
        className={`tnum mt-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap ${DUE_TONE[tone]}`}
      >
        {text}
      </p>
    </td>
  );
}

function DueDateBanner({ deposit }: { deposit: Deposit }) {
  const { t, language } = useLanguage();
  const { text, tone } = useCountdownText(deposit);

  return (
    <div className="mt-3 flex items-baseline justify-between gap-3 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-accent">
          {t("field.dueDate")}
        </p>
        <p className="tnum text-base leading-tight font-bold">
          {formatDate(deposit.dueDate, language)}
        </p>
      </div>
      <p className={`tnum shrink-0 text-xs font-semibold ${DUE_TONE[tone]}`}>
        {text}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function RowActions({
  deposit,
  onEdit,
  onPay,
  onDelete,
}: {
  deposit: Deposit;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted transition-colors hover:text-ink";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/customers/${deposit.id}`}
        title={t("action.viewDetails")}
        aria-label={t("action.viewDetails")}
        className={iconButton}
      >
        <EyeIcon />
      </Link>
      <button
        type="button"
        onClick={onEdit}
        title={t("common.edit")}
        aria-label={t("common.edit")}
        className={iconButton}
      >
        <PencilIcon />
      </button>
      {!deposit.paidAt && (
        <button
          type="button"
          onClick={onPay}
          title={t("action.markPaid")}
          aria-label={t("action.markPaid")}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover"
        >
          <CheckIcon />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        title={t("common.delete")}
        aria-label={t("common.delete")}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface text-st-overdue transition-colors hover:bg-st-overdue-bg"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function Th({
  children,
  align = "start",
  accent = false,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  accent?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap ${
        align === "end" ? "text-end" : "text-start"
      } ${
        accent
          ? "border-x border-line bg-accent-soft text-accent"
          : "text-muted"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "start",
  className = "",
  dir,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  dir?: "ltr";
}) {
  return (
    <td
      dir={dir}
      className={`px-3 py-3 ${align === "end" ? "text-end" : "text-start"} ${className}`}
    >
      {children}
    </td>
  );
}

function CardField({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "profit" | "fee";
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-faint">{label}</dt>
      <dd
        className={`tnum truncate text-sm ${
          strong ? "font-bold" : "font-medium"
        } ${tone === "profit" ? "text-st-paid" : ""} ${
          tone === "fee" ? "text-st-due" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
