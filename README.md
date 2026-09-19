# Maareynta Lacagta

Bilingual (Somali / English) manager for fixed-term deposits that pay back the
principal plus a 35% return.

```
Gross                          = Principal x 1.45   (stored, not displayed)
Broker Commission (Dilaalka)   = Principal x 10%    <- of the PRINCIPAL
Net Return (Macmiilku Helayaa) = Gross - Commission <- what the customer is paid
Profit (Faa'iido)              = Net - Principal
Due Date                       = Deposit Date + Duration (days)
```

The commission is 10% of the **principal**, never of the gross. For a $100
deposit that is $10.00, not $14.50. Net therefore works out to
principal x 1.35 — exactly what customers received before the commission
existed, so introducing it did not devalue any existing deposit.

| Principal | Gross (internal) | Dilaalka (10%) | Net to customer | Profit |
| --- | --- | --- | --- | --- |
| $100.00 | $145.00 | $10.00 | **$135.00** | $35.00 |
| $200.00 | $290.00 | $20.00 | **$270.00** | $70.00 |
| $1,000.00 | $1,450.00 | $100.00 | **$1,350.00** | $350.00 |
| $5,000.00 | $7,250.00 | $500.00 | **$6,750.00** | $1,750.00 |

The commission belongs to the administrator and is totalled on the dashboard as
**Dilaalka La Helay / Broker Commission**, across all deposits. Only a Super
Admin sees it. The gross figure is still stored for reporting but is no longer
shown anywhere in the interface.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres).

---

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the three values (see below)
npm run dev                  # http://localhost:3000
```

### Environment

`.env.local` — **all three are server-only. Never add a `NEXT_PUBLIC_` prefix**,
or Next.js will inline them into the browser bundle.

| Variable | Meaning |
| --- | --- |
| `SUPABASE_URL` | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | Publishable API key (Supabase → Project Settings → API Keys) |
| `MONEY_APP_KEY` | Shared secret required by the RLS policies (below) |

---

## Multi-tenant: branches, accounts and roles

The app is multi-tenant. Every deposit belongs to exactly one **branch**, and a
branch's data is never visible outside it.

| | Super Admin | Admin |
| --- | --- | --- |
| Manage branches (create/rename/disable/delete) | **yes** | no |
| Manage accounts (create/disable/delete/reset password) | **yes** | no |
| Dashboard, customers, add / edit / delete / mark paid | **no** | yes, within its own branch |
| Dilaalka (its branch's broker commission) | **no** | **yes, its own** |
| Change own password | yes | yes |

The **Super Admin runs the business, not a branch**: it manages branches and
accounts and sees no customer, no total, and no money anywhere in the app. An
**Admin runs exactly one branch**: it sees only that branch's customers, totals
and commission, and cannot see any other branch's data or reach `/branches` or
`/users`.

Isolation is enforced on the **server**, not just hidden with CSS or a
disabled nav item:

- `requireBranchUser()` (`lib/auth.ts`) redirects a Super Admin away from every
  deposit page, and hands each Admin page its own `branchId` from the session --
  never from anything the browser sends.
- Every deposit read and write (`lib/deposits.ts`, `app/actions.ts`) filters by
  that `branchId`. Guessing another branch's customer id resolves as "not
  found," not as that branch's data -- verified end-to-end in `tests/e2e.mjs`.
- The database backs this with a CHECK constraint: a `super_admin` row must have
  `branch_id IS NULL`, an `admin` row must have one. A row that violates the
  invariant cannot exist.
- Disabling a branch immediately signs out everyone in it and refuses their next
  sign-in with a clear message, rather than letting them load a page and bounce.
- A branch with any accounts or customers cannot be deleted (checked in the
  action, and backed by `ON DELETE RESTRICT` on the foreign keys), so a branch's
  data can never be silently orphaned.

### The one owner

One account is the **owner** (`is_owner`, enforced unique by a partial index --
the database physically cannot hold a second one). Other Super Admins have the
identical set of powers, with one exception: they cannot disable, delete,
rename, demote, or reset the owner's password. That is what keeps every other
Super Admin an equal rather than a subordinate, while keeping one account that
cannot be locked out by the others.

### Sign-in identifier

Accounts sign in with a short **username** (e.g. `ridwan`), not an email
address, at the owner's request -- lowercase, 3-30 characters of
`[a-z0-9._-]`. `MIN_PASSWORD_LENGTH` is deliberately 4 for the same reason
(quick logins for a small, trusted team); the brute-force throttle in
`app/auth-actions.ts` carries the security weight instead of password length.
Raise both if this is ever exposed to the public internet.

### Why not Supabase Auth

This project's `auth.users` carries the Cafeteria trigger
`trg_on_auth_user_created`, which inserts **every** new account into
`public.profiles` as an active `cashier` -- which would hand it access to
Cafeteria orders, products and payments through Cafeteria's own RLS. Cafeteria is
read-only for us, so that trigger cannot be changed. The Money system therefore
keeps its own `money_users` / `money_sessions` tables and never touches
`auth.users`. Verified after the change: `auth.users` and `public.profiles` both
still hold exactly their original 3 rows.

### How sign-in works

- Passwords are hashed with **scrypt** (N=16384, r=8, p=1, 16-byte random salt)
  in `lib/auth.ts` and compared with `timingSafeEqual`. Nothing plaintext or
  reversible is ever stored.
- The session cookie holds a 32-byte random token; only its **SHA-256** is
  stored, so a dump of `money_sessions` cannot be replayed as a login. The cookie
  is `HttpOnly`, `SameSite=Lax`, and `Secure` in production, with a 7-day expiry.
- Disabling an account or resetting its password **revokes its sessions
  immediately**, rather than waiting for the cookie to expire.
- Sign-in failures are throttled per username (6 per minute) and return the
  same message whether the address exists or the password was wrong, so the form
  cannot be used to discover which accounts exist.

> That throttle is per server process and memory-only, which is proportionate for
> a single-operator tool. A multi-instance deployment would want it in the
> database.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Admin only (a Super Admin is redirected to `/branches`): its branch's customer count, active deposits, total deposited, expected return (net), expected profit, broker commission, due-soon, overdue, recently added |
| `/customers` | Search, table (desktop) / cards (mobile), add, edit, delete, mark paid |
| `/customers/[id]` | Full summary card with countdown ("15 days remaining" / "Due Today" / "5 days overdue") |
| `/login` | Sign-in screen -- the only page reachable while signed out |
| `/branches` | Super Admin only: create, rename, disable, delete branches |
| `/users` | Super Admin only: create accounts (each tied to one branch), disable, delete, reset passwords |

---

## Money and dates

**Money is never a float.** Amounts are stored and computed as integer cents.
Gross, commission and net all use exact integer arithmetic with an explicit
half-up rule (`lib/money.ts`), so results never depend on binary floating-point
rounding. Display always goes through one formatter → `$1,350.00`.

**The commission is deducted exactly once.** `net` is defined as
`gross - commission` rather than as `principal x 1.35`, in both the database and
`lib/money.ts`, so the three figures can never disagree by a cent and the fee
cannot be double-counted. Everything the customer sees or is paid uses the
**net**; the admin commission total uses the **broker fee**.

**Dates are plain `YYYY-MM-DD` strings** and all arithmetic goes through
`Date.UTC` (`lib/dates.ts`), so a daylight-saving shift cannot move a due date
by a day.

**The due date is the primary column.** It sits second in the customers table,
straight after the name, is accent-tinted, and carries the countdown directly
beneath the date. On phones it becomes its own highlighted band on each card.

**Status is derived, never stored.** Only `paid_at` is persisted; Active /
Due Today / Overdue are computed from `due_date` against today. A stored status
column would go stale the moment the calendar rolled over. "Today" comes from
the browser's local date (`components/TodayProvider.tsx`), so a UTC server never
shows the wrong "Due Today".

---

## Database

One table, in the shared `sandbox-cafeteria` Supabase project. **Every object
carries a `money_` prefix** so it cannot collide with the Cafeteria system that
also lives in that project's `public` schema.

```
public.money_deposits
  id, branch_id -> money_branches(id) ON DELETE RESTRICT,
  full_name, phone, deposit_cents, deposit_date, duration_days,
  due_date            GENERATED = deposit_date + duration_days
  gross_return_cents  GENERATED = round(deposit_cents * 1.45)
  broker_fee_cents    GENERATED = round(deposit_cents * 0.10)
  net_return_cents    GENERATED = gross - broker fee
  profit_cents        GENERATED = net - deposit_cents
  paid_at, created_at, updated_at

public.money_branches
  id, name (unique, case-insensitive), active, created_at, updated_at

public.money_users
  id, username (unique, login identifier), full_name, password_hash (scrypt),
  role ('super_admin' | 'admin'), branch_id -> money_branches(id) or NULL,
  is_owner (at most one true, enforced by a partial unique index),
  active, created_at, updated_at, last_login_at
  CHECK: super_admin has branch_id NULL; admin has branch_id NOT NULL

public.money_sessions
  id, token_hash (sha256 of the cookie token), user_id -> money_users(id),
  expires_at, created_at

public.money_set_updated_at()   -- trigger fn (its own, not the shared one)
public.money_app_authorized()   -- RLS predicate
```

`due_date` and all four money figures are **STORED generated columns**: the
values are physically written to the table, so reports, history and dashboard
statistics read real stored data, and the database is the single source of truth
for the business rule. The figures cannot drift from whatever the UI computed;
the app recomputes them client-side only for the live preview in the add/edit
form. Postgres forbids a generated column referencing another generated column,
so each expression is written in terms of `deposit_cents`.

> Because the rates live in the generated-column expressions, changing them
> rewrites the figures for **every** row, including historical ones. If you ever
> need old deposits to keep their original rates, the multiplier and fee percent
> would need to become per-row columns.

### Security model

`money_deposits` has RLS enabled with four policies that all require
`money_app_authorized()`, which checks for a private `x-app-key` request header:

- The app touches the database **only from server actions** (`app/actions.ts`)
  via a server-only client (`lib/supabase.ts`). The Supabase key never reaches
  the browser — verified by grepping the built client bundle.
- Because the policies also demand the app secret, **a leaked publishable key on
  its own cannot read or write this table.**

To rotate `MONEY_APP_KEY`, update the literal inside
`public.money_app_authorized()` and the `.env.local` value together.

> **Hardening option.** For stricter isolation, swap `SUPABASE_KEY` for a secret
> key and drop the `anon` grants from the policies, so only the server role can
> reach the table at all.

---

## Language (Somali / English)

- Default is **Somali**; `SO | EN` switcher sits in the header at every breakpoint.
- All strings live in one table: `i18n/translations.ts`. No UI text is inlined in
  a component. `en` is the reference shape and `so` is typed against it, so the
  build fails if either language is missing a key.
- Switching applies instantly, with no reload.
- The choice is saved in `localStorage` and **mirrored into a cookie of the same
  name**. The cookie is purely a server-rendering hint: without it the first
  paint would render the default language and visibly flip once JavaScript
  hydrated.
- Customer-entered data (names, phone numbers) is never translated, and money
  and dates keep the same numeric formatting in both languages.

> Keys used by both server and client (storage keys, the pre-hydration theme
> script) live in `lib/client-storage.ts`, which deliberately has no
> `"use client"` directive — every export of a client module becomes an opaque
> *client reference* when a server component imports it, which silently breaks
> `cookies().get(...)` and inline scripts.

---

## Testing

Pure logic (gross / commission / net, parsing, date arithmetic) has no
dependencies and is covered by the end-to-end run below.

`tests/e2e.mjs` drives a real browser through the whole app: the signed-out gate
on every route, a Super Admin confined to `/branches` with zero money visible
anywhere, creating two branches and one admin account per branch, and then --
the core guarantee -- **branch isolation**: each admin's dashboard and customer
list start empty, adding a customer in one branch never appears in the other's
totals or table, and a direct URL to another branch's customer resolves as "not
found" rather than leaking it. It also verifies disabling a branch immediately
locks out its admin with a clear message, a branch with data cannot be deleted,
and the full deposit-to-payout workflow (commission, net return, mark as paid)
still works inside a branch.

Credentials come from the environment so no password sits in the repo (only the
Super Admin's; branch admins are created by the run itself). It deletes
everything it creates (branches, accounts and customers prefixed `E2E`) and
purges leftovers from any earlier aborted run before starting, so a crash cannot
poison the next run.

Its dashboard section is **derived, not hardcoded**: it reads every row off the
customers table, asserts `gross = 1.45P`, `dilaal = 10%P`, `net = gross - dilaal`
and `profit = net - P` per row, then checks that the dashboard cards equal those
sums (commission across all deposits, expected return/profit across unpaid
only). So it keeps passing as you add real customers.

```bash
npm run dev                                          # terminal 1
npm i -D playwright && npx playwright install chromium
E2E_USERNAME=ridwan E2E_PASSWORD=... node tests/e2e.mjs
```

Playwright is intentionally not a project dependency — it pulls a ~100 MB
browser that the app itself does not need.

---

## Seed data

| Name | Principal | Duration | Gross | Dilaalka | Net | Profit |
| --- | --- | --- | --- | --- | --- | --- |
| Ahmed | $100.00 | 20 days | $145.00 | $10.00 | $135.00 | $35.00 |
| Ali | $200.00 | 25 days | $290.00 | $20.00 | $270.00 | $70.00 |
| Hassan | $1,000.00 | 30 days | $1,450.00 | $100.00 | $1,350.00 | $350.00 |
| Mohamed | $5,000.00 | 45 days | $7,250.00 | $500.00 | $6,750.00 | $1,750.00 |

Their deposit dates are staggered so the four statuses are all visible at once.
