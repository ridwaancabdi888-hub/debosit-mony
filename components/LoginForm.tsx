"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";
import { signIn } from "@/app/auth-actions";
import { useT } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, TranslationKey | undefined>
  >({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return; // Guards against a double submit.

    setFormError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await signIn(username, password);
      if (result.ok) {
        router.replace(result.redirectTo ?? "/");
        router.refresh();
        return;
      }
      setFormError(result.message);
      setFieldErrors(result.fields ?? {});
    });
  };

  const inputClass = (invalid: boolean) =>
    `h-11 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-faint ${
      invalid ? "border-st-overdue" : "border-line-strong"
    }`;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white"
          >
            $
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{t("app.name")}</h1>
            <p className="mt-0.5 text-sm text-muted">{t("app.tagline")}</p>
          </div>
        </div>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">{t("auth.loginTitle")}</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            {t("auth.loginSubtitle")}
          </p>

          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-username" className="text-sm font-medium">
                {t("auth.username")}
              </label>
              <input
                id="login-username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.usernamePlaceholder")}
                aria-invalid={Boolean(fieldErrors.username)}
                className={inputClass(Boolean(fieldErrors.username))}
              />
              {fieldErrors.username && (
                <p role="alert" className="text-xs font-medium text-st-overdue">
                  {t(fieldErrors.username)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                {t("auth.password")}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                className={inputClass(Boolean(fieldErrors.password))}
              />
              {fieldErrors.password && (
                <p role="alert" className="text-xs font-medium text-st-overdue">
                  {t(fieldErrors.password)}
                </p>
              )}
            </div>

            {formError && !fieldErrors.username && !fieldErrors.password && (
              <p
                role="alert"
                className="rounded-lg border border-st-overdue/40 bg-st-overdue-bg px-3 py-2 text-sm font-medium text-st-overdue"
              >
                {t(formError)}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              className="mt-1 h-11 w-full"
            >
              {isPending ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
