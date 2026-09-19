"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useToday } from "@/components/TodayProvider";
import { Card, EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { DUE_SOON_WINDOW_DAYS, deriveStatus, isDueSoon } from "@/lib/status";
import type { Deposit } from "@/lib/types";

const RECENT_LIMIT = 5;

export function DashboardView({ deposits }: { deposits: Deposit[] }) {
  const { t, language } = useLanguage();
  const today = useToday();

  const stats = useMemo(() => {
    let depositedCents = 0;
    let brokerFeeCents = 0;
    let expectedReturnCents = 0;
    let expectedProfitCents = 0;
    let active = 0;
    let dueSoon = 0;
    let overdue = 0;

    for (const deposit of deposits) {
      depositedCents += deposit.depositCents;

      // The administrator's commission is counted across every deposit, and
      // exactly once each — it is already netted out of net_return_cents.
      brokerFeeCents += deposit.brokerFeeCents;

      // "Expected" means still outstanding — a paid deposit is realised, not
      // expected. The figure owed is the NET return, after the commission.
      if (!deposit.paidAt) {
        active += 1;
        expectedReturnCents += deposit.netReturnCents;
        expectedProfitCents += deposit.profitCents;
        if (deriveStatus(deposit, today) === "overdue") overdue += 1;
        if (isDueSoon(deposit, today)) dueSoon += 1;
      }
    }

    return {
      depositedCents,
      brokerFeeCents,
      expectedReturnCents,
      expectedProfitCents,
      active,
      dueSoon,
      overdue,
    };
  }, [deposits, today]);

  const recent = deposits.slice(0, RECENT_LIMIT);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

      {/* --------------------------------------------------- count cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          labelKey="dashboard.totalCustomers"
          value={String(deposits.length)}
        />
        <StatCard
          labelKey="dashboard.activeDeposits"
          value={String(stats.active)}
          hintKey="dashboard.activeHint"
        />
        <StatCard
          labelKey="dashboard.dueSoon"
          value={String(stats.dueSoon)}
          hint={t("dashboard.dueSoonHint", { count: DUE_SOON_WINDOW_DAYS })}
          tone={stats.dueSoon > 0 ? "due" : undefined}
        />
        <StatCard
          labelKey="dashboard.overdue"
          value={String(stats.overdue)}
          hintKey="dashboard.overdueHint"
          tone={stats.overdue > 0 ? "overdue" : undefined}
        />
      </div>

      {/* --------------------------------------------------- money cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyCard
          labelKey="dashboard.totalDeposited"
          value={formatCents(stats.depositedCents)}
        />
        <MoneyCard
          labelKey="dashboard.expectedReturn"
          value={formatCents(stats.expectedReturnCents)}
          hintKey="dashboard.activeHint"
        />
        <MoneyCard
          labelKey="dashboard.expectedProfit"
          value={formatCents(stats.expectedProfitCents)}
          hintKey="dashboard.activeHint"
          tone="profit"
        />
        <MoneyCard
          labelKey="dashboard.brokerCommission"
          value={formatCents(stats.brokerFeeCents)}
          hintKey="dashboard.brokerCommissionHint"
          tone="fee"
        />
      </div>

      {/* ------------------------------------------- recently added list */}
      <Card>
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">{t("dashboard.recent")}</h2>
          {deposits.length > 0 && (
            <Link
              href="/customers"
              className="shrink-0 text-sm font-medium text-accent hover:underline"
            >
              {t("dashboard.viewAll")}
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title={t("dashboard.empty")}
            hint={t("dashboard.emptyHint")}
          />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((deposit) => (
              <li key={deposit.id}>
                <Link
                  href={`/customers/${deposit.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{deposit.fullName}</p>
                    <p className="tnum truncate text-xs text-muted" dir="ltr">
                      {deposit.phone}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="tnum text-sm font-semibold">
                      {formatCents(deposit.depositCents)}
                    </span>
                    <span aria-hidden="true" className="text-faint">
                      →
                    </span>
                    <span className="tnum text-sm font-semibold text-st-paid">
                      {formatCents(deposit.netReturnCents)}
                    </span>
                    <span className="tnum hidden text-xs text-muted md:inline">
                      {formatDate(deposit.dueDate, language)}
                    </span>
                    <StatusBadge status={deriveStatus(deposit, today)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  );
}

/* ------------------------------------------------------------------- cards */

const TONE_VALUE = {
  due: "text-st-due",
  overdue: "text-st-overdue",
  profit: "text-st-paid",
  fee: "text-accent",
} as const;

function StatCard({
  labelKey,
  value,
  hintKey,
  hint,
  tone,
}: {
  labelKey: TranslationKey;
  value: string;
  hintKey?: TranslationKey;
  hint?: string;
  tone?: keyof typeof TONE_VALUE;
}) {
  const { t } = useLanguage();
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs leading-snug font-medium text-muted">
        {t(labelKey)}
      </p>
      <p
        className={`tnum text-2xl font-bold tracking-tight ${
          tone ? TONE_VALUE[tone] : ""
        }`}
      >
        {value}
      </p>
      {(hint || hintKey) && (
        <p className="text-[11px] leading-snug text-faint">
          {hint ?? t(hintKey as TranslationKey)}
        </p>
      )}
    </Card>
  );
}

function MoneyCard({
  labelKey,
  value,
  hintKey,
  tone,
}: {
  labelKey: TranslationKey;
  value: string;
  hintKey?: TranslationKey;
  tone?: keyof typeof TONE_VALUE;
}) {
  const { t } = useLanguage();
  return (
    <Card className="flex flex-col gap-1 p-4 sm:p-5">
      <p className="text-xs font-medium text-muted">{t(labelKey)}</p>
      <p
        className={`tnum text-xl font-bold tracking-tight sm:text-2xl ${
          tone ? TONE_VALUE[tone] : ""
        }`}
      >
        {value}
      </p>
      {hintKey && (
        <p className="text-[11px] text-faint">{t(hintKey)}</p>
      )}
    </Card>
  );
}
