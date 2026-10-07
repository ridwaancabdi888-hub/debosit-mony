import assert from "node:assert/strict";
import test from "node:test";

import {
  computeBrokerFeeCents,
  computeGrossReturnCents,
  computeNetReturnCents,
  computeProfitCents,
  centsToInputValue,
  formatCents,
  parseAmountToCents,
} from "../lib/money.ts";
import {
  addDays,
  diffDays,
  formatDate,
  isValidIsoDate,
} from "../lib/dates.ts";

test("money calculations match the documented business examples", () => {
  const examples = [
    { principal: 10_000, gross: 14_500, fee: 1_000, net: 13_500, profit: 3_500 },
    { principal: 20_000, gross: 29_000, fee: 2_000, net: 27_000, profit: 7_000 },
    { principal: 100_000, gross: 145_000, fee: 10_000, net: 135_000, profit: 35_000 },
    { principal: 500_000, gross: 725_000, fee: 50_000, net: 675_000, profit: 175_000 },
  ];

  for (const example of examples) {
    assert.equal(computeGrossReturnCents(example.principal), example.gross);
    assert.equal(computeBrokerFeeCents(example.principal), example.fee);
    assert.equal(computeNetReturnCents(example.principal), example.net);
    assert.equal(computeProfitCents(example.principal), example.profit);
  }
});

test("percentage calculations use explicit half-up cent rounding", () => {
  assert.equal(computeGrossReturnCents(10), 15);
  assert.equal(computeBrokerFeeCents(5), 1);
  assert.equal(computeNetReturnCents(10), 14);
  assert.equal(computeProfitCents(10), 4);
});

test("money relationships remain internally consistent", () => {
  for (const principal of [1, 5, 10, 99, 101, 12_345, 999_999_999]) {
    const gross = computeGrossReturnCents(principal);
    const fee = computeBrokerFeeCents(principal);
    const net = computeNetReturnCents(principal);
    const profit = computeProfitCents(principal);

    assert.equal(net, gross - fee);
    assert.equal(profit, net - principal);
    assert.ok(Number.isInteger(gross));
    assert.ok(Number.isInteger(fee));
  }
});

test("money input accepts supported user formats", () => {
  assert.equal(parseAmountToCents("1,234.5"), 123_450);
  assert.equal(parseAmountToCents("$1,234.50"), 123_450);
  assert.equal(parseAmountToCents(" 100 "), 10_000);
  assert.equal(parseAmountToCents("0.01"), 1);
  assert.equal(parseAmountToCents("0"), 0);
});

test("money input rejects malformed or unsafe values", () => {
  for (const value of ["", "-1", "1.234", "1e3", "12 dollars", ".50", "1,2,3x"]) {
    assert.equal(parseAmountToCents(value), null, value);
  }
  assert.equal(parseAmountToCents("999999999999999999999"), null);
});

test("money formatting and editable values preserve cents and signs", () => {
  assert.equal(formatCents(135_000), "$1,350.00");
  assert.equal(formatCents(-105), "-$1.05");
  assert.equal(centsToInputValue(123_450), "1234.50");
  assert.equal(centsToInputValue(-105), "-1.05");
  assert.equal(centsToInputValue(0), "0.00");
});

test("ISO date validation rejects impossible calendar dates", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-04-31"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("06-10-2026"), false);
});

test("date arithmetic crosses month, year and leap-day boundaries", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-28", 2), "2024-03-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(diffDays("2026-10-01", "2026-10-08"), 7);
  assert.equal(diffDays("2026-10-08", "2026-10-01"), -7);
});

test("date display is deterministic in Somali and English", () => {
  assert.equal(formatDate("2026-10-05", "so"), "05 Okt 2026");
  assert.equal(formatDate("2026-10-05", "en"), "05 Oct 2026");
  assert.equal(formatDate("not-a-date", "en"), "not-a-date");
});
