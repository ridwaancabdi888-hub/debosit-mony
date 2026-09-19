"use client";

import Link from "next/link";

import { Button, Card } from "@/components/ui";
import { useLanguage } from "@/i18n/LanguageProvider";

/** Shown when the database is unreachable or the environment is not configured. */
export function LoadError({ kind }: { kind: "unconfigured" | "error" }) {
  const { t } = useLanguage();
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <p className="text-base font-semibold">{t("error.loadFailed")}</p>
      <p className="mt-2 text-sm text-muted">
        {kind === "unconfigured" ? t("error.config") : t("error.generic")}
      </p>
    </Card>
  );
}

/** Shown for a detail page whose customer has been deleted. */
export function NotFoundView() {
  const { t } = useLanguage();
  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <p className="text-base font-semibold">{t("detail.notFound")}</p>
      <p className="mt-2 mb-4 text-sm text-muted">{t("detail.notFoundHint")}</p>
      <Link href="/customers">
        <Button variant="primary">{t("detail.backToCustomers")}</Button>
      </Link>
    </Card>
  );
}
