"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Button, Card, EmptyState, PageHeading } from "@/components/ui";
import {
  createBranch,
  deleteBranch,
  renameBranch,
  setBranchActive,
} from "@/app/branch-actions";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { Branch } from "@/lib/branches";

/**
 * The super admin's screen. It deliberately shows no customer counts, balances
 * or commission — only branch names, their state, and how many accounts each
 * has. Each branch's money stays inside that branch.
 */
export function BranchesView({ branches }: { branches: Branch[] }) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const toggleActive = (branch: Branch) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await setBranchActive(branch.id, !branch.active);
      showToast(result.message, result.ok ? "success" : "error");
    });
  };

  const addButton = (
    <Button
      variant="primary"
      onClick={() => setAddOpen(true)}
      className="w-full sm:w-auto"
    >
      <PlusIcon />
      {t("branches.add")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={t("branches.title")}
        subtitle={t("branches.subtitle")}
        action={addButton}
      />

      {branches.length === 0 ? (
        <Card>
          <EmptyState
            title={t("branches.empty")}
            hint={t("branches.emptyHint")}
            action={addButton}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {branches.map((branch) => (
            <li key={branch.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{branch.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        branch.active
                          ? "bg-st-paid-bg text-st-paid"
                          : "bg-st-overdue-bg text-st-overdue"
                      }`}
                    >
                      {t(
                        branch.active
                          ? "branches.active"
                          : "branches.disabled",
                      )}
                    </span>
                  </div>
                  <p className="tnum mt-0.5 text-xs text-muted">
                    {t("branches.accounts", { count: branch.accountCount })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRenameTarget(branch)}
                    disabled={isPending}
                  >
                    <PencilIcon />
                    {t("branches.rename")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleActive(branch)}
                    disabled={isPending}
                    title={t("branches.disabledNote")}
                  >
                    {t(
                      branch.active
                        ? "branches.deactivate"
                        : "branches.activate",
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(branch)}
                    disabled={isPending}
                    aria-label={t("common.delete")}
                    className="text-st-overdue hover:bg-st-overdue-bg"
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {addOpen && <BranchNameDialog onClose={() => setAddOpen(false)} />}
      {renameTarget && (
        <BranchNameDialog
          branch={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteBranchDialog
          branch={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------- add / rename ---- */

function BranchNameDialog({
  branch,
  onClose,
}: {
  branch?: Branch;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(branch?.name ?? "");
  const [error, setError] = useState<TranslationKey | undefined>();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setError(undefined);

    startTransition(async () => {
      const result = branch
        ? await renameBranch(branch.id, name)
        : await createBranch(name);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onClose();
        return;
      }
      setError(result.fields?.name ?? result.message);
    });
  };

  return (
    <Modal
      open
      title={
        branch
          ? t("branches.renameTitle", { name: branch.name })
          : t("branches.addTitle")
      }
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
            form="branch-name-form"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="branch-name-form" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="branch-name" className="text-sm font-medium">
            {t("branches.name")}
          </label>
          <input
            id="branch-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("branches.namePlaceholder")}
            autoComplete="off"
            maxLength={80}
            aria-invalid={Boolean(error)}
            className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-faint ${
              error ? "border-st-overdue" : "border-line-strong"
            }`}
          />
          {error && (
            <p role="alert" className="text-xs font-medium text-st-overdue">
              {t(error)}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- delete -- */

function DeleteBranchDialog({
  branch,
  onClose,
}: {
  branch: Branch;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteBranch(branch.id);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) onClose();
    });
  };

  return (
    <Modal
      open
      title={t("branches.deleteTitle")}
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
        {t("branches.deleteMessage", { name: branch.name })}
      </p>
      <p className="mt-2 text-sm text-muted">{t("delete.warning")}</p>
    </Modal>
  );
}
