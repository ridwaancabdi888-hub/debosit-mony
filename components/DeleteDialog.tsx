"use client";

import { useTransition } from "react";

import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { deleteDeposit } from "@/app/actions";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { Deposit } from "@/lib/types";

export function DeleteDialog({
  deposit,
  onClose,
  onDeleted,
}: {
  deposit: Deposit | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!deposit) return null;

  const confirm = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteDeposit(deposit.id);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onClose();
        onDeleted?.();
      }
    });
  };

  return (
    <Modal
      open
      title={t("delete.title")}
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
            variant="danger"
            onClick={confirm}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.deleting") : t("common.delete")}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {t("delete.message", { name: deposit.fullName })}
      </p>
      <p className="mt-2 text-sm text-muted">{t("delete.warning")}</p>
    </Modal>
  );
}
