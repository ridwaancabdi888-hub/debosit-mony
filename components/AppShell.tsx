"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/app/auth-actions";
import { useT } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { AuthUser } from "@/lib/auth";

type NavItem = { href: string; labelKey: TranslationKey; icon: string };

/** A branch admin runs the deposit business. */
const BRANCH_NAV: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: "▦" },
  { href: "/customers", labelKey: "nav.customers", icon: "☰" },
];

/** The super admin manages branches and accounts, and nothing else. */
const SUPER_ADMIN_NAV: NavItem[] = [
  { href: "/branches", labelKey: "nav.branches", icon: "◈" },
  { href: "/users", labelKey: "nav.users", icon: "◍" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Signed out (the login screen): no navigation to offer, but the language and
  // theme controls still need to be reachable.
  if (!user) {
    return (
      <div className="min-h-dvh">
        <div className="absolute end-3 top-3 z-10 flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    );
  }

  const nav = user.role === "super_admin" ? SUPER_ADMIN_NAV : BRANCH_NAV;

  const navLinks = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            // Closed on click rather than in an effect on `pathname`, so the
            // drawer never triggers a second render pass after navigation.
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <span aria-hidden="true" className="w-4 text-center text-xs">
              {item.icon}
            </span>
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="min-w-0">
      <p className="truncate text-[13px] leading-tight font-bold tracking-tight">
        {t("app.name")}
      </p>
      <p className="truncate text-[11px] text-faint">{t("app.tagline")}</p>
    </div>
  );

  const logo = (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
    >
      $
    </span>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ---------------------------------------------- desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <div className="flex items-center gap-2.5 px-1 pt-1">
          {logo}
          {brand}
        </div>
        {navLinks}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ------------------------------------------------------ header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("nav.openMenu")}
            aria-expanded={drawerOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2 text-muted transition-colors hover:text-ink lg:hidden"
          >
            <span aria-hidden="true">☰</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
            {brand}
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-7">
          {children}
        </main>
      </div>

      {/* ------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("nav.closeMenu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="animate-rise absolute inset-y-0 start-0 flex w-64 max-w-[80%] flex-col gap-6 border-e border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {logo}
                {brand}
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-muted hover:text-ink"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {navLinks}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- user menu -- */

function UserMenu({ user }: { user: AuthUser }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <div ref={wrapper} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          title={user.fullName}
          className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-2 transition-colors hover:text-ink"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white"
          >
            {initials || "?"}
          </span>
          <span className="hidden max-w-28 truncate text-xs font-medium sm:block">
            {user.fullName}
          </span>
        </button>

        {open && (
          <div
            role="menu"
            className="animate-rise absolute end-0 top-11 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="border-b border-line px-3 py-3">
              <p className="text-[11px] text-faint">{t("auth.signedInAs")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold">
                {user.fullName}
              </p>
              <p className="tnum truncate text-xs text-muted" dir="ltr">
                {user.username}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {t(
                    user.role === "super_admin"
                      ? "users.roleSuperAdmin"
                      : "users.roleAdmin",
                  )}
                </span>
                {user.isOwner && (
                  <span className="inline-flex rounded-full bg-st-due-bg px-2 py-0.5 text-[11px] font-semibold text-st-due">
                    {t("users.owner")}
                  </span>
                )}
                {user.branchName && (
                  <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {user.branchName}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
              className="block w-full px-3 py-2.5 text-start text-sm transition-colors hover:bg-surface-2"
            >
              {t("auth.changePassword")}
            </button>

            <form action={signOut} className="border-t border-line">
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-start text-sm font-medium text-st-overdue transition-colors hover:bg-st-overdue-bg"
              >
                {t("auth.signOut")}
              </button>
            </form>
          </div>
        )}
      </div>

      {passwordOpen && (
        <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />
      )}
    </>
  );
}
