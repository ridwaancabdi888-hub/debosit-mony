"use client";

import { useMemo, useState, useTransition } from "react";

import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useToday } from "@/components/TodayProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import { createDeposit, updateDeposit } from "@/app/actions";
import { addDays, formatDate, isValidIsoDate } from "@/lib/dates";
import {
  centsToInputValue,
  computeBrokerFeeCents,
  computeNetReturnCents,
  computeProfitCents,
  formatCents,
  parseAmountToCents,
} from "@/lib/money";
import { validateDeposit, type FieldErrors } from "@/lib/validation";
import type { Deposit } from "@/lib/types";

const QUICK_DURATIONS = [20, 25, 30, 45] as const;

type FormState = {
  fullName: string;
  phone: string;
  depositAmount: string;
  depositDate: string;
  durationDays: string;
};

function initialState(deposit: Deposit | null, today: string): FormState {
  if (!deposit) {
    return {
      fullName: "",
      phone: "",
      depositAmount: "",
      depositDate: today,
      durationDays: "30",
    };
  }
  return {
    fullName: deposit.fullName,
    phone: deposit.phone,
    depositAmount: centsToInputValue(deposit.depositCents),
    depositDate: deposit.depositDate,
    durationDays: String(deposit.durationDays),
  };
}

export function CustomerForm({
  open,
  deposit,
  onClose,
}: {
  open: boolean;
  deposit: Deposit | null;
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const today = useToday();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>(() =>
    initialState(deposit, today),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [customMode, setCustomMode] = useState(
    () =>
      deposit !== null &&
      !QUICK_DURATIONS.includes(
        deposit.durationDays as (typeof QUICK_DURATIONS)[number],
      ),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // Live preview of the calculated values, shown before saving.
  const preview = useMemo(() => {
    const cents = parseAmountToCents(form.depositAmount);
    const days = /^\d{1,5}$/.test(form.durationDays.trim())
      ? Number(form.durationDays.trim())
      : null;
    const dateOk = isValidIsoDate(form.depositDate);
    const principal = cents !== null && cents > 0 ? cents : null;

    return {
      depositCents: principal,
      brokerFeeCents:
        principal === null ? null : computeBrokerFeeCents(principal),
      netReturnCents:
        principal === null ? null : computeNetReturnCents(principal),
      profitCents: principal === null ? null : computeProfitCents(principal),
      dueDate:
        dateOk && days && days > 0 ? addDays(form.depositDate, days) : null,
      days,
    };
  }, [form.depositAmount, form.durationDays, form.depositDate]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return; // Guards against a double submit.

    const validation = validateDeposit(form);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = deposit
        ? await updateDeposit(deposit.id, form)
        : await createDeposit(form);

      if (result.ok) {
        showToast(result.message, "success");
        onClose();
        return;
      }
      if (result.fields) setErrors(result.fields);
      showToast(result.message, "error");
    });
  };

  return (
    <Modal
      open={open}
      title={deposit ? t("form.editTitle") : t("form.addTitle")}
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
            type="submit"
            form="customer-form"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="customer-form"
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field
          label={t("field.name")}
          error={errors.fullName && t(errors.fullName)}
        >
          {(id, invalid) => (
            <input
              id={id}
              type="text"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder={t("form.namePlaceholder")}
              autoComplete="off"
              maxLength={120}
              aria-invalid={invalid}
              className={inputClass(invalid)}
            />
          )}
        </Field>

        <Field label={t("field.phone")} error={errors.phone && t(errors.phone)}>
          {(id, invalid) => (
            <input
              id={id}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder={t("form.phonePlaceholder")}
              autoComplete="off"
              maxLength={25}
              aria-invalid={invalid}
              className={`${inputClass(invalid)} tnum`}
              dir="ltr"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("field.deposit")}
            error={errors.depositAmount && t(errors.depositAmount)}
          >
            {(id, invalid) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-faint">
                  $
                </span>
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={form.depositAmount}
                  onChange={(e) => set("depositAmount", e.target.value)}
                  placeholder={t("form.depositPlaceholder")}
                  autoComplete="off"
                  aria-invalid={invalid}
                  className={`${inputClass(invalid)} tnum ps-7`}
                  dir="ltr"
                />
              </div>
            )}
          </Field>

          <Field
            label={t("field.depositDate")}
            error={errors.depositDate && t(errors.depositDate)}
          >
            {(id, invalid) => (
              <input
                id={id}
                type="date"
                value={form.depositDate}
                onChange={(e) => set("depositDate", e.target.value)}
                aria-invalid={invalid}
                className={`${inputClass(invalid)} tnum`}
              />
            )}
          </Field>
        </div>

        {/* ------------------------------------------------- duration */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t("field.duration")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map((days) => {
              const selected =
                !customMode && form.durationDays === String(days);
              return (
                <button
                  key={days}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setCustomMode(false);
                    set("durationDays", String(days));
                  }}
                  className={`tnum rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line-strong bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {days} {t("common.days")}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={customMode}
              onClick={() => {
                setCustomMode(true);
                set("durationDays", "");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                customMode
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line-strong bg-surface text-muted hover:text-ink"
              }`}
            >
              {t("form.durationCustom")}
            </button>
          </div>

          {customMode && (
            <label className="mt-1 flex flex-col gap-1.5">
              <span className="text-xs text-muted">
                {t("form.durationCustomLabel")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.durationDays}
                onChange={(e) =>
                  set("durationDays", e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="60"
                autoComplete="off"
                maxLength={5}
                aria-invalid={Boolean(errors.durationDays)}
                className={`${inputClass(Boolean(errors.durationDays))} tnum sm:max-w-40`}
                dir="ltr"
              />
            </label>
          )}

          {errors.durationDays && (
            <p role="alert" className="text-xs font-medium text-st-overdue">
              {t(errors.durationDays)}
            </p>
          )}
        </fieldset>

        {/* ------------------------------------- calculated preview */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{t("form.summary")}</p>
            <p className="text-[11px] text-faint">{t("form.summaryHint")}</p>
          </div>
          <dl className="flex flex-col">
            <PreviewRow
              label={t("field.dueDate")}
              value={
                preview.dueDate ? formatDate(preview.dueDate, language) : "—"
              }
            />
            <PreviewRow
              label={t("field.brokerFee")}
              value={
                preview.brokerFeeCents !== null
                  ? `- ${formatCents(preview.brokerFeeCents)}`
                  : "—"
              }
              tone="fee"
            />
            <PreviewRow
              label={t("field.netReturn")}
              value={
                preview.netReturnCents !== null
                  ? formatCents(preview.netReturnCents)
                  : "—"
              }
              emphasis
            />
            <PreviewRow
              label={t("field.profit")}
              value={
                preview.profitCents !== null
                  ? formatCents(preview.profitCents)
                  : "—"
              }
              tone="profit"
            />
          </dl>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- primitives */

function inputClass(invalid: boolean): string {
  return `h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-faint ${
    invalid ? "border-st-overdue" : "border-line-strong"
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (id: string, invalid: boolean) => React.ReactNode;
}) {
  const id = `field-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const invalid = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, invalid)}
      {error && (
        <p role="alert" className="text-xs font-medium text-st-overdue">
          {error}
        </p>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  emphasis = false,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "profit" | "fee";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`tnum text-right ${
          emphasis ? "text-base font-bold" : "text-sm font-semibold"
        } ${tone === "profit" ? "text-st-paid" : ""} ${
          tone === "fee" ? "text-st-due" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
