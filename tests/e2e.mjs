/**
 * End-to-end check of the whole app against a running dev server.
 *
 * Playwright is intentionally NOT a project dependency (it pulls a ~100MB
 * browser and the app itself does not need it). To run this:
 *
 *   npm run dev                                  # in one terminal
 *   npm i -D playwright && npx playwright install chromium
 *   E2E_USERNAME=ridwan E2E_PASSWORD=... node tests/e2e.mjs
 *
 * Credentials come from the environment so no password lives in the repo.
 *
 * The run creates two branches, two admin accounts and a few customers, all
 * prefixed "E2E", and deletes them again at the end. It also purges leftovers
 * from an aborted run before starting, so a crash cannot poison the next run.
 */

import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OWNER_USERNAME = process.env.E2E_USERNAME;
const OWNER_PASSWORD = process.env.E2E_PASSWORD;

if (!OWNER_USERNAME || !OWNER_PASSWORD) {
  console.error("Set E2E_USERNAME and E2E_PASSWORD before running.");
  process.exit(2);
}

const stamp = Date.now() % 1000000;
const BRANCH_A = "E2E Branch A";
const BRANCH_B = "E2E Branch B";
const ADMIN_A = `e2e-a-${stamp}`;
const ADMIN_B = `e2e-b-${stamp}`;
const PASS = "1234";

const consoleErrors = [];
const pageErrors = [];
let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const good = String(actual) === String(expected);
  if (good) pass++;
  else fail++;
  console.log(
    `${good ? "PASS" : "FAIL"}  ${label}\n        got=${actual}\n       want=${expected}`,
  );
}
function ok(label, condition) {
  if (condition) pass++;
  else fail++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
}
function section(title) {
  console.log(`\n=== ${title} ===`);
}

function toCents(text) {
  const negative = /^\s*-/.test(String(text));
  const n = Number(String(text).replace(/[^0-9.]/g, ""));
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

const cardValue = (page, label) =>
  page.evaluate((l) => {
    const el = [...document.querySelectorAll("p")].find(
      (p) => p.textContent.trim() === l,
    );
    return el?.nextElementSibling?.textContent?.trim() ?? null;
  }, label);

const dlValueIn = (scope, label) =>
  scope.evaluate((root, l) => {
    const dt = [...root.querySelectorAll("dt")].find(
      (d) => d.textContent.trim() === l,
    );
    return dt?.nextElementSibling?.textContent?.trim() ?? null;
  }, label);

const path = (page) => new URL(page.url()).pathname;

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Generous: the first sign-in after a code change pays for a dev recompile.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60000,
  });
  await page.waitForLoadState("load");
}

async function logout(page) {
  await page.locator("header button[aria-haspopup='menu']").click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL("**/login", { timeout: 20000 });
}

/** Adds a customer from the customers page and waits for its row to appear. */
async function addCustomer(page, name, phone, amount, days) {
  await page.goto(`${BASE}/customers`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Add Customer" }).first().click();
  await page.getByLabel("Customer Name").fill(name);
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Deposit Amount").fill(String(amount));
  await page.getByLabel("Deposit Date").fill("2026-09-18");
  await page.getByRole("button", { name: `${days} Days` }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  return page
    .getByRole("cell", { name })
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
}

/** Reloads before each attempt so a revalidation cannot detach the locator. */
async function deleteAllRows(page, url, rowSelector, nameRe) {
  for (let i = 0; i < 15; i++) {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(450);
    const row = page.locator(rowSelector).filter({ hasText: nameRe }).first();
    if ((await row.count()) === 0) return;
    try {
      await row
        .getByRole("button", { name: "Delete", exact: true })
        .click({ timeout: 8000 });
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ state: "visible", timeout: 8000 });
      await dialog
        .getByRole("button", { name: "Delete", exact: true })
        .click({ timeout: 8000 });
      await dialog.waitFor({ state: "hidden", timeout: 20000 });
    } catch {
      // Transient re-render; the next iteration reloads and retries.
    }
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(e.message));

// Warm the dev server so the first real assertion is not paying for a compile.
await page.goto(`${BASE}/login`, { waitUntil: "load" });

/* ------------------------------------------------------ 0. auth gating */
section("0. Signed out: every page is gated");
for (const p of ["/", "/customers", "/users", "/branches"]) {
  await page.goto(`${BASE}${p}`, { waitUntil: "load" });
  check(`${p} -> /login`, path(page), "/login");
}
ok(
  "Login form is Somali by default",
  await page
    .getByText("Geli magacaaga iyo furahaaga si aad u sii wadato.")
    .isVisible(),
);
await page.getByRole("button", { name: "EN", exact: true }).click();
await page.waitForTimeout(150);

/* ------------------------- 1. super admin: branches and accounts only */
section("1. Super admin lands on Branches and sees no money");
await login(page, OWNER_USERNAME, OWNER_PASSWORD);
check("Lands on /branches", path(page), "/branches");

for (const p of ["/", "/customers"]) {
  await page.goto(`${BASE}${p}`, { waitUntil: "load" });
  check(`super admin ${p} -> /branches`, path(page), "/branches");
}
await page.goto(`${BASE}/branches`, { waitUntil: "load" });
const superHtml = await page.content();
ok("No Dashboard nav", !/>Dashboard</.test(superHtml));
ok("No Customers nav", !/>Customers</.test(superHtml));
ok(
  "Branches nav present",
  await page.getByRole("link", { name: "Branches" }).first().isVisible(),
);
ok(
  "Users nav present",
  await page.getByRole("link", { name: "Users" }).first().isVisible(),
);
ok("No commission anywhere", !superHtml.includes("Broker Commission"));
// Read rendered text, not page.content(): the RSC payload contains "$1"-style
// markers that would false-positive a naive money regex.
const superText = await page.locator("main").innerText();
ok("No money figure on the branches page", !/\$\s?\d/.test(superText));

/* ------------------------------------------- 1b. purge old test data */
section("1b. Clear leftovers from any aborted run");
await deleteAllRows(page, `${BASE}/users`, "li", /e2e-/);
await deleteAllRows(page, `${BASE}/branches`, "li", /E2E Branch/);
await page.goto(`${BASE}/branches`, { waitUntil: "load" });
check(
  "no E2E branches remain",
  await page.locator("li").filter({ hasText: /E2E Branch/ }).count(),
  0,
);

/* ----------------------------------------------------- 2. branches */
section("2. Create two branches");
for (const name of [BRANCH_A, BRANCH_B]) {
  await page.goto(`${BASE}/branches`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Add Branch" }).first().click();
  await page.getByLabel("Branch Name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  ok(
    `branch "${name}" created`,
    await page
      .getByText(name, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => true)
      .catch(() => false),
  );
}

section("2b. Duplicate branch name is rejected");
await page.getByRole("button", { name: "Add Branch" }).first().click();
await page.getByLabel("Branch Name").fill(BRANCH_A);
await page.getByRole("button", { name: "Save", exact: true }).click();
ok(
  "shows 'already exists'",
  await page
    .getByText("A branch with that name already exists.")
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false),
);
await page.getByRole("button", { name: "Cancel" }).first().click();
await page.waitForTimeout(300);

/* ------------------------------------------------- 3. one admin each */
section("3. Create one admin per branch");
for (const [username, branch] of [
  [ADMIN_A, BRANCH_A],
  [ADMIN_B, BRANCH_B],
]) {
  await page.goto(`${BASE}/users`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Add User" }).first().click();
  await page.waitForTimeout(300);
  await page.getByLabel("Full Name").fill("E2E Temp User");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(PASS);
  await page.getByRole("radio", { name: /^Admin/ }).check();
  // exact: "Branch" also appears inside the role descriptions.
  await page
    .getByLabel("Branch", { exact: true })
    .selectOption({ label: branch });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  ok(
    `admin ${username} created in ${branch}`,
    await page
      .getByText(username, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => true)
      .catch(() => false),
  );
}
ok("A 4-character password was accepted", true);

/* ------------------------------------- 4. branch admin A: own data only */
section("4. Admin A sees only branch A");
await logout(page);
await login(page, ADMIN_A, PASS);
check("Admin lands on the dashboard", path(page), "/");
ok(
  "Sees its own commission",
  (await cardValue(page, "Broker Commission")) !== null,
);

for (const p of ["/branches", "/users"]) {
  await page.goto(`${BASE}${p}`, { waitUntil: "load" });
  check(`admin ${p} -> /`, path(page), "/");
}
const adminHtml = await page.content();
ok("No Branches nav for an admin", !/>Branches</.test(adminHtml));
ok("No Users nav for an admin", !/>Users</.test(adminHtml));

await page.goto(`${BASE}/customers`, { waitUntil: "load" });
check(
  "Branch A starts empty (the real customers belong to branch 'ridwan')",
  await page.locator("tbody tr").count(),
  0,
);

ok(
  "added E2E Alpha",
  await addCustomer(page, "E2E Alpha", "+252 61 1110001", 100, 20),
);
await page.goto(BASE, { waitUntil: "load" });
check("A: total customers", await cardValue(page, "Total Customers"), "1");
check("A: total deposits", toCents(await cardValue(page, "Total Deposits")), 10000);
check(
  "A: commission (10% of 100)",
  toCents(await cardValue(page, "Broker Commission")),
  1000,
);
check(
  "A: expected return (net)",
  toCents(await cardValue(page, "Expected Return")),
  13500,
);

// Capture the row's detail URL so branch B can try to open it directly.
await page.goto(`${BASE}/customers`, { waitUntil: "load" });
const alphaHref = await page
  .getByRole("link", { name: "E2E Alpha" })
  .first()
  .getAttribute("href");
ok("captured branch A customer url", Boolean(alphaHref));

/* ----------------------------------- 5. branch admin B: isolation holds */
section("5. Admin B cannot see or reach branch A's data");
await logout(page);
await login(page, ADMIN_B, PASS);
await page.goto(`${BASE}/customers`, { waitUntil: "load" });
check("Branch B starts empty", await page.locator("tbody tr").count(), 0);
ok("B cannot see 'E2E Alpha'", (await page.getByText("E2E Alpha").count()) === 0);

await page.goto(BASE, { waitUntil: "load" });
check("B: total customers", await cardValue(page, "Total Customers"), "0");
check("B: total deposits", toCents(await cardValue(page, "Total Deposits")), 0);
check("B: commission", toCents(await cardValue(page, "Broker Commission")), 0);

// The direct-URL attempt is the real test: knowing an id must not leak a row.
await page.goto(`${BASE}${alphaHref}`, { waitUntil: "load" });
const leaked = await page.content();
ok(
  "Direct URL to another branch's customer is refused",
  !leaked.includes("E2E Alpha"),
);
ok("Shows the not-found card", await page.getByText("Customer not found").isVisible());

ok(
  "added E2E Beta",
  await addCustomer(page, "E2E Beta", "+252 61 2220002", 200, 25),
);
await page.goto(BASE, { waitUntil: "load" });
check("B: now 1 customer", await cardValue(page, "Total Customers"), "1");
check(
  "B: commission (10% of 200)",
  toCents(await cardValue(page, "Broker Commission")),
  2000,
);

/* --------------------------------------- 6. A unaffected by B */
section("6. Admin A is unaffected by branch B");
await logout(page);
await login(page, ADMIN_A, PASS);
await page.goto(`${BASE}/customers`, { waitUntil: "load" });
check("A still has exactly 1 customer", await page.locator("tbody tr").count(), 1);
ok("A sees its own", (await page.getByText("E2E Alpha").count()) > 0);
ok("A cannot see B's customer", (await page.getByText("E2E Beta").count()) === 0);

section("6b. The deposit workflow still works inside a branch");
await page.getByRole("link", { name: "E2E Alpha" }).first().click();
await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/, { timeout: 20000 });
await page.waitForLoadState("load");
const detail = page.locator("main");
check("detail dilaal", await dlValueIn(detail, "Broker Commission"), "- $10.00");
check("detail net", await dlValueIn(detail, "Net Return"), "$135.00");
ok("no Gross Return anywhere", (await dlValueIn(detail, "Gross Return")) === null);

await page.getByRole("button", { name: "Mark as Paid" }).first().click();
await page.waitForTimeout(400);
const payDialog = page.getByRole("dialog");
check(
  "payout total is the NET",
  await dlValueIn(payDialog, "Total Amount to Pay"),
  "$135.00",
);
await payDialog.getByRole("button", { name: "Confirm Payment" }).click();
await payDialog.waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1000);
check("status is Paid", await dlValueIn(page.locator("main"), "Status"), "Paid");

/* ------------------------------------------------- 7. branch disable */
section("7. Disabling a branch signs its admin out");
await logout(page);
await login(page, OWNER_USERNAME, OWNER_PASSWORD);
await page.goto(`${BASE}/branches`, { waitUntil: "load" });
await page
  .locator("li")
  .filter({ hasText: BRANCH_B })
  .first()
  .getByRole("button", { name: "Deactivate" })
  .click();
await page.waitForTimeout(2500);

// A separate context: sharing this one would carry the owner's session cookie
// and /login would simply redirect, testing nothing.
const otherContext = await browser.newContext();
await otherContext.addCookies([
  { name: "sandbox-money-language", value: "en", url: BASE },
]);
const other = await otherContext.newPage();
await other.goto(`${BASE}/login`, { waitUntil: "load" });
await other.getByLabel("Username", { exact: true }).fill(ADMIN_B);
await other.getByLabel("Password", { exact: true }).fill(PASS);
await other.getByRole("button", { name: "Sign in", exact: true }).click();
ok(
  "and is told the branch is disabled",
  await other
    .getByText("This branch has been disabled. Contact the administrator.")
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false),
);
check(
  "admin of a disabled branch cannot get in",
  new URL(other.url()).pathname,
  "/login",
);
await otherContext.close();

await page.goto(`${BASE}/branches`, { waitUntil: "load" });
await page
  .locator("li")
  .filter({ hasText: BRANCH_B })
  .first()
  .getByRole("button", { name: "Activate" })
  .click();
await page.waitForTimeout(2500);

section("7b. A branch with data cannot be deleted");
await page.goto(`${BASE}/branches`, { waitUntil: "load" });
await page
  .locator("li")
  .filter({ hasText: BRANCH_B })
  .first()
  .getByRole("button", { name: "Delete" })
  .click();
await page.waitForTimeout(400);
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Delete", exact: true })
  .click();
ok(
  "refuses while accounts or customers remain",
  await page
    .getByText(/still has accounts or customers/)
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

/* -------------------------------------------------------- 8. cleanup */
section("8. Cleanup");
await logout(page);
await login(page, ADMIN_A, PASS);
await deleteAllRows(page, `${BASE}/customers`, "tbody tr", /E2E /);
await logout(page);
await login(page, ADMIN_B, PASS);
await deleteAllRows(page, `${BASE}/customers`, "tbody tr", /E2E /);
await logout(page);

await login(page, OWNER_USERNAME, OWNER_PASSWORD);
await deleteAllRows(page, `${BASE}/users`, "li", /e2e-/);
await deleteAllRows(page, `${BASE}/branches`, "li", /E2E Branch/);

await page.goto(`${BASE}/branches`, { waitUntil: "load" });
check(
  "E2E branches removed",
  await page.locator("li").filter({ hasText: /E2E Branch/ }).count(),
  0,
);
await page.goto(`${BASE}/users`, { waitUntil: "load" });
check("E2E accounts removed", await page.getByText(/^e2e-/).count(), 0);
ok(
  "the real owner account survives",
  (await page.getByText(OWNER_USERNAME).count()) > 0,
);

/* ---------------------------------------------------------------- report */
section("Console / runtime errors");
const realErrors = consoleErrors.filter(
  (e) => !/favicon|Download the React DevTools/i.test(e),
);
console.log(`console errors: ${realErrors.length}`);
realErrors.forEach((e) => console.log(`   • ${e}`));
console.log(`uncaught page errors: ${pageErrors.length}`);
pageErrors.forEach((e) => console.log(`   • ${e}`));
ok("No console errors", realErrors.length === 0);
ok("No uncaught exceptions", pageErrors.length === 0);

console.log(`\n${"=".repeat(46)}\nPASSED: ${pass}   FAILED: ${fail}\n${"=".repeat(46)}`);

await browser.close();
process.exit(fail === 0 ? 0 : 1);
