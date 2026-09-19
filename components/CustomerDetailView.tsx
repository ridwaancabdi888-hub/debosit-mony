"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Countdown } from "@/components/Countdown";
import { CustomerForm } from "@/components/CustomerForm";
import { DeleteDialog } from "@/components/DeleteDialog";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";
import { useToday } from "@/components/TodayProvider";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { Button, Card, DetailRow, StatusBadge } from "@/components/ui";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { deriveStatus } from "@/lib/status";
import type { Deposit } from "@/lib/types";

export function CustomerDetailView({ deposit }: { deposit: Deposit }) {
  const { t, language } = useLanguage();
  const today = useToday();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const status = deriveStatus(deposit, today);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          {t("detail.backToCustomers")}
        </Link>
      </div>

      <Card className="overflow-hidden">
        {/* ------------------------------------------------------ header */}
        <div className="flex flex-col gap-4 border-b border-line bg-surface-2 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-faint uppercase">
              {t("detail.title")}
            </p>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">
              {deposit.fullName}
            </h1>
            <p className="tnum mt-0.5 text-sm text-muted" dir="ltr">
              {deposit.phone}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={status} />
            <Countdown deposit={deposit} />
          </div>
        </div>

        {/* ------------------------------------------- headline figures */}
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Figure
            label={t("field.deposit")}
            value={formatCents(deposit.depositCents)}
          />
          <Figure
            label={t("field.brokerFee")}
            value={`- ${formatCents(deposit.brokerFeeCents)}`}
            tone="fee"
          />
          <Figure
            label={t("field.netReturn")}
            value={formatCents(deposit.netReturnCents)}
            emphasis
          />
          <Figure
            label={t("field.dueDate")}
            value={formatDate(deposit.dueDate, language)}
            accent
          />
        </div>

        {/* -------------------------------------------------- full detail */}
        <dl className="flex flex-col px-5 py-2">
          <DetailRow label={t("field.name")} value={deposit.fullName} />
          <DetailRow
            label={t("field.phone")}
            value={<span dir="ltr">{deposit.phone}</span>}
          />
          <DetailRow
            label={t("field.deposit")}
            value={formatCents(deposit.depositCents)}
          />
          <DetailRow
            label={t("field.depositDate")}
            value={formatDate(deposit.depositDate, language)}
          />
          <DetailRow
            label={t("field.duration")}
            value={`${deposit.durationDays} ${t("common.days")}`}
          />
          <DetailRow
            label={t("field.dueDate")}
            value={formatDate(deposit.dueDate, language)}
          />
          <DetailRow
            label={t("field.brokerFee")}
            value={
              <span className="text-st-due">
                - {formatCents(deposit.brokerFeeCents)}
              </span>
            }
          />
          <DetailRow
            label={t("field.netReturn")}
            value={formatCents(deposit.netReturnCents)}
            emphasis
          />
          <DetailRow
            label={t("field.profit")}
            value={
              <span className="text-st-paid">
                {formatCents(deposit.profitCents)}
              </span>
            }
          />
          <DetailRow
            label={t("field.status")}
            value={<StatusBadge status={status} />}
          />
          {deposit.paidAt && (
            <DetailRow
              label={t("field.paymentDate")}
              value={formatDate(deposit.paidAt, language)}
            />
          )}
        </dl>

        {/* ------------------------------------------------------ actions */}
        <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center">
          {!deposit.paidAt && (
            <Button
              variant="primary"
              onClick={() => setPayOpen(true)}
              className="w-full sm:w-auto"
            >
              <CheckIcon />
              {t("action.markPaid")}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => setEditOpen(true)}
            className="w-full sm:w-auto"
          >
            <PencilIcon />
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            className="w-full text-st-overdue hover:bg-st-overdue-bg sm:ms-auto sm:w-auto"
          >
            <TrashIcon />
            {t("common.delete")}
          </Button>
        </div>
      </Card>

      {editOpen && (
        <CustomerForm
          open
          deposit={deposit}
          onClose={() => setEditOpen(false)}
        />
      )}
      {payOpen && (
        <MarkPaidDialog deposit={deposit} onClose={() => setPayOpen(false)} />
      )}
      {deleteOpen && (
        <DeleteDialog
          deposit={deposit}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => router.push("/customers")}
        />
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
  tone,
  accent = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "profit" | "fee";
  accent?: boolean;
}) {
  return (
    <div
      className={`border-b border-line px-5 py-4 sm:border-b-0 ${
        accent ? "bg-accent-soft" : ""
      }`}
    >
      <p
        className={`text-xs font-medium ${accent ? "text-accent" : "text-muted"}`}
      >
        {label}
      </p>
      <p
        className={`tnum mt-0.5 font-bold tracking-tight ${
          emphasis ? "text-2xl" : "text-xl"
        } ${tone === "profit" ? "text-st-paid" : ""} ${
          tone === "fee" ? "text-st-due" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
