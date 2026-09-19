"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { changeOwnPassword } from "@/app/auth-actions";
import { useT } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<
    Record<string, TranslationKey | undefined>
  >({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setErrors({});

    startTransition(async () => {
      const result = await changeOwnPassword(current, next, confirm);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onClose();
        return;
      }
      setErrors(result.fields ?? {});
    });
  };

  return (
    <Modal
      open
      title={t("auth.changePassword")}
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
            form="change-password-form"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="change-password-form"
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <PasswordField
          id="pw-current"
          label={t("auth.currentPassword")}
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          error={errors.currentPassword && t(errors.currentPassword)}
        />
        <PasswordField
          id="pw-new"
          label={t("auth.newPassword")}
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          error={errors.newPassword && t(errors.newPassword)}
        />
        <PasswordField
          id="pw-confirm"
          label={t("auth.confirmPassword")}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirmPassword && t(errors.confirmPassword)}
        />
      </form>
    </Modal>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
}) {
  const invalid = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="password"
        dir="ltr"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink ${
          invalid ? "border-st-overdue" : "border-line-strong"
        }`}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-st-overdue">
          {error}
        </p>
      )}
    </div>
  );
}
