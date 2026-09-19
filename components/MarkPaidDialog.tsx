"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useToday } from "@/components/TodayProvider";
import { Button, DetailRow } from "@/components/ui";
import { markDepositPaid } from "@/app/actions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { isValidIsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { Deposit } from "@/lib/types";

/**
 * Shows the exact payout — name, principal, profit and total — and captures the
 * payment date before anything is written.
 */
export function MarkPaidDialog({
  deposit,
  onClose,
}: {
  deposit: Deposit | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const today = useToday();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [paymentDate, setPaymentDate] = useState(today);
  const [dateError, setDateError] = useState(false);

  if (!deposit) return null;

  const confirm = () => {
    if (isPending) return;
    if (!isValidIsoDate(paymentDate) || paymentDate < deposit.depositDate) {
      setDateError(true);
      return;
    }
    setDateError(false);

    startTransition(async () => {
      const result = await markDepositPaid(deposit.id, paymentDate);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) onClose();
    });
  };

  return (
    <Modal
      open
      title={t("markPaid.title")}
      onClose={isPending ? () => {} : onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={confirm}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("markPaid.confirm")}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">{t("markPaid.intro")}</p>

      <dl className="mb-4 flex flex-col rounded-xl border border-line bg-surface-2 px-4 py-1">
        <DetailRow label={t("field.name")} value={deposit.fullName} />
        <DetailRow
          label={t("markPaid.originalDeposit")}
          value={formatCents(deposit.depositCents)}
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
          label={t("field.profit")}
          value={
            <span className="text-st-paid">
              + {formatCents(deposit.profitCents)}
            </span>
          }
        />
        <DetailRow
          label={t("markPaid.totalToPay")}
          value={formatCents(deposit.netReturnCents)}
          emphasis
        />
      </dl>

      <p className="mb-4 text-xs text-faint">{t("markPaid.netNote")}</p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("markPaid.dateLabel")}</span>
        <input
          type="date"
          value={paymentDate}
          min={deposit.depositDate}
          onChange={(event) => {
            setPaymentDate(event.target.value);
            setDateError(false);
          }}
          aria-invalid={dateError}
          className={`tnum h-10 w-full rounded-lg border bg-surface px-3 text-sm sm:max-w-52 ${
            dateError ? "border-st-overdue" : "border-line-strong"
          }`}
        />
        {dateError && (
          <p role="alert" className="text-xs font-medium text-st-overdue">
            {t("validation.dateInvalid")}
          </p>
        )}
      </label>
    </Modal>
  );
}
