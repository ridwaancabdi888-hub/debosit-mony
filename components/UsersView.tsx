"use client";

import { useState, useTransition } from "react";

import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Button, Card, EmptyState, PageHeading } from "@/components/ui";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserActive,
} from "@/app/user-actions";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { Role } from "@/lib/auth";
import type { Branch } from "@/lib/branches";
import type { ManagedUser } from "@/lib/users";

/** Unambiguous alphabet: no 0/O/1/l/I, so a written-down password transcribes cleanly. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [
    chars.slice(0, 4).join(""),
    chars.slice(4, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
  ].join("-");
}

export function UsersView({
  users,
  branches,
  currentUserId,
  currentUserIsOwner,
}: {
  users: ManagedUser[];
  branches: Branch[];
  currentUserId: string;
  currentUserIsOwner: boolean;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const toggleActive = (user: ManagedUser) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.active);
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
      {t("users.add")}
    </Button>
  );

  const formatWhen = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(iso))
      : t("users.never");

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        action={addButton}
      />

      <p className="tnum text-xs text-muted">
        {t("users.count", { count: users.length })}
      </p>

      {users.length === 0 ? (
        <Card>
          <EmptyState
            title={t("users.empty")}
            hint={t("users.emptyHint")}
            action={addButton}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            // Every super admin is an equal, with one exception: the owner
            // account is untouchable by anyone but the owner.
            const ownerLocked = user.isOwner && !currentUserIsOwner;
            const blockReason = ownerLocked
              ? t("users.ownerProtected")
              : undefined;
            return (
              <li key={user.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{user.fullName}</p>
                      {isSelf && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {t("users.you")}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.role === "super_admin"
                            ? "bg-accent-soft text-accent"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {t(
                          user.role === "super_admin"
                            ? "users.roleSuperAdmin"
                            : "users.roleAdmin",
                        )}
                      </span>
                      {user.isOwner && (
                        <span className="rounded-full bg-st-due-bg px-2 py-0.5 text-[11px] font-semibold text-st-due">
                          {t("users.owner")}
                        </span>
                      )}
                      {user.branchName && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          {user.branchName}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          user.active
                            ? "bg-st-paid-bg text-st-paid"
                            : "bg-st-overdue-bg text-st-overdue"
                        }`}
                      >
                        {t(user.active ? "users.active" : "users.disabled")}
                      </span>
                    </div>
                    <p className="tnum mt-0.5 truncate text-sm text-muted" dir="ltr">
                      {user.username}
                    </p>
                    <p className="tnum mt-0.5 text-[11px] text-faint">
                      {t("users.lastLogin")}: {formatWhen(user.lastLoginAt)}
                      {user.isOwner ? " - " + t("users.ownerHint") : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setResetTarget(user)}
                      disabled={isPending || ownerLocked}
                      title={blockReason}
                    >
                      <PencilIcon />
                      {t("users.resetPassword")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleActive(user)}
                      disabled={isPending || isSelf || ownerLocked}
                      title={isSelf ? t("users.cannotSelfDisable") : blockReason}
                    >
                      {t(user.active ? "users.deactivate" : "users.activate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(user)}
                      disabled={isPending || isSelf || ownerLocked}
                      title={isSelf ? t("users.cannotSelfDelete") : blockReason}
                      aria-label={t("common.delete")}
                      className="text-st-overdue hover:bg-st-overdue-bg"
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {addOpen && (
        <AddUserDialog branches={branches} onClose={() => setAddOpen(false)} />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- add user -- */

function AddUserDialog({
  branches,
  onClose,
}: {
  branches: Branch[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const activeBranches = branches.filter((b) => b.active);
  const [branchId, setBranchId] = useState<string>(
    activeBranches[0]?.id ?? "",
  );
  const [errors, setErrors] = useState<
    Record<string, TranslationKey | undefined>
  >({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setErrors({});

    startTransition(async () => {
      const result = await createUser({
        fullName,
        username,
        password,
        role,
        branchId: role === "admin" ? branchId || null : null,
      });
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
      title={t("users.addTitle")}
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
            form="add-user-form"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="add-user-form"
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField
          id="user-name"
          label={t("users.fullName")}
          value={fullName}
          onChange={setFullName}
          placeholder={t("users.namePlaceholder")}
          error={errors.fullName && t(errors.fullName)}
        />
        <TextField
          id="user-username"
          label={t("users.username")}
          value={username}
          onChange={setUsername}
          placeholder={t("auth.usernamePlaceholder")}
          hint={t("users.usernameInvalid")}
          error={errors.username && t(errors.username)}
        />

        <PasswordWithGenerate
          value={password}
          onChange={setPassword}
          error={errors.password && t(errors.password)}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("users.role")}</legend>
          {(["admin", "super_admin"] as const).map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                role === option
                  ? "border-accent bg-accent-soft"
                  : "border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="mt-0.5 accent-[var(--app-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(
                    option === "super_admin"
                      ? "users.roleSuperAdmin"
                      : "users.roleAdmin",
                  )}
                </span>
                <span className="block text-xs text-muted">
                  {t(
                    option === "super_admin"
                      ? "users.roleSuperAdminHint"
                      : "users.roleAdminHint",
                  )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* Only an admin belongs to a branch. */}
        {role === "admin" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="user-branch" className="text-sm font-medium">
              {t("users.branch")}
            </label>
            {activeBranches.length === 0 ? (
              <p className="rounded-lg border border-st-due/40 bg-st-due-bg px-3 py-2 text-xs font-medium text-st-due">
                {t("users.noBranches")}
              </p>
            ) : (
              <select
                id="user-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                aria-invalid={Boolean(errors.branchId)}
                className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink ${
                  errors.branchId ? "border-st-overdue" : "border-line-strong"
                }`}
              >
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            {errors.branchId && (
              <p role="alert" className="text-xs font-medium text-st-overdue">
                {t(errors.branchId)}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------- reset password -- */

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: ManagedUser;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<TranslationKey | undefined>();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setError(undefined);

    startTransition(async () => {
      const result = await resetUserPassword(user.id, password);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        onClose();
        return;
      }
      setError(result.fields?.password ?? result.message);
    });
  };

  return (
    <Modal
      open
      title={t("users.resetPasswordTitle", { name: user.fullName })}
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
            form="reset-password-form"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={submit} noValidate>
        <PasswordWithGenerate
          value={password}
          onChange={setPassword}
          error={error && t(error)}
        />
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- delete user -- */

function DeleteUserDialog({
  user,
  onClose,
}: {
  user: ManagedUser;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteUser(user.id);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.ok) onClose();
    });
  };

  return (
    <Modal
      open
      title={t("users.deleteTitle")}
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
        {t("users.deleteMessage", { name: user.fullName })}
      </p>
      <p className="mt-2 text-sm text-muted">{t("delete.warning")}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------ primitives -- */

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
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
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid}
        className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-faint ${
          invalid ? "border-st-overdue" : "border-line-strong"
        }`}
      />
      {error ? (
        <p role="alert" className="text-xs font-medium text-st-overdue">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

function PasswordWithGenerate({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { t } = useLanguage();
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="user-password" className="text-sm font-medium">
        {t("auth.password")}
      </label>
      <div className="flex gap-2">
        <input
          id="user-password"
          // Shown in clear text on purpose: the admin has to read it out to the
          // person receiving the account.
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          dir="ltr"
          aria-invalid={invalid}
          className={`tnum h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm text-ink ${
            invalid ? "border-st-overdue" : "border-line-strong"
          }`}
        />
        <Button
          variant="secondary"
          onClick={() => onChange(generatePassword())}
          className="shrink-0"
        >
          {t("users.generate")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-st-overdue">
          {error}
        </p>
      ) : (
        <p className="text-xs text-faint">{t("users.passwordNote")}</p>
      )}
    </div>
  );
}
