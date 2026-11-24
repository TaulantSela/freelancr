import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  formatMKD,
  getDDVStatus,
  getLocalSupplies,
  getRateToMKD,
  getTaxDeadlinesForTaxYear,
  getUpcomingTaxDeadlines,
  toSkopjeDate,
} from "./calculator";

describe("tax deadlines", () => {
  it("not registered: e-PDD by the 10th and tax by the 15th of the next month, then the annual return", () => {
    const d = getTaxDeadlinesForTaxYear("paid_from_abroad", 2026, ["2026-12"]);
    assert.deepEqual(
      d.map((x) => `${x.kind} ${x.period} ${x.dueDate}`),
      [
        "report 2026-12 2027-01-10",
        "pay 2026-12 2027-01-15",
        "returnConfirm 2026 2027-05-31",
        "returnPay 2026 2027-06-30",
      ]
    );
  });

  it("not registered: a month without self-reported income has nothing to file", () => {
    const d = getTaxDeadlinesForTaxYear("paid_from_abroad", 2026, [], [2026]);
    assert.deepEqual(d.map((x) => x.kind), ["returnConfirm", "returnPay"]);
  });

  it("self-employed: twelve advances by the 15th, then ПДД-ДБ by 15 March and payment by 30 March", () => {
    const d = getTaxDeadlinesForTaxYear("self_employed", 2026, []);
    assert.equal(d.filter((x) => x.kind === "advance").length, 12);
    assert.equal(d.find((x) => x.period === "2026-12")?.dueDate, "2027-01-15");
    assert.equal(d.find((x) => x.kind === "annualReturn")?.dueDate, "2027-03-15");
    assert.equal(d.find((x) => x.kind === "annualPayment")?.dueDate, "2027-03-30");
  });

  it("lists only what's still ahead, soonest first", () => {
    const d = getUpcomingTaxDeadlines("paid_from_abroad", "2026-11-11", ["2026-10", "2026-11"]);
    assert.equal(d[0].dueDate, "2026-11-15");
    assert.ok(d.every((x) => x.dueDate >= "2026-11-11"));
  });
});

describe("DDV threshold", () => {
  const invoice = (clientCountry: string, status: string, supplyDate: string | null, totalMKD: number) => ({
    clientCountry,
    status,
    supplyDate,
    date: "2026-01-15",
    totalMKD,
  });

  it("counts issued invoices to clients in North Macedonia only, by date of supply", () => {
    const s = getLocalSupplies(
      [
        invoice("MK", "sent", "2026-03-01", 1_500_000),
        invoice("DE", "paid", "2026-04-01", 5_000_000),
        invoice("MK", "cancelled", "2026-05-01", 900_000),
        invoice("MK", "draft", "2026-05-01", 900_000),
        invoice("MK", "paid", "2025-12-31", 700_000),
        invoice("MK", "overdue", null, 100_000),
      ],
      2026
    );
    assert.deepEqual(s, { totalMKD: 1_600_000, count: 2 });
  });

  it("adds local payouts without an invoice and takes off credit notes, never below 0", () => {
    const s = getLocalSupplies(
      [invoice("MK", "sent", "2026-03-01", 100_000)],
      2026,
      [{ clientCountry: "MK", receivedOn: "2026-06-01", valueMKD: 50_000 }, { clientCountry: "US", receivedOn: "2026-06-01", valueMKD: 999_999 }],
      [{ clientCountry: "MK", date: "2026-07-01", amountMKD: 30_000 }]
    );
    assert.deepEqual(s, { totalMKD: 120_000, count: 2 });
    assert.equal(getLocalSupplies([], 2026, [], [{ clientCountry: "MK", date: "2026-07-01", amountMKD: 30_000 }]).totalMKD, 0);
  });

  it("warns at 70% and 85%, and registration is due only over 2,000,000", () => {
    assert.equal(getDDVStatus(1_399_999).alertLevel, "safe");
    assert.equal(getDDVStatus(1_400_000).alertLevel, "warning");
    assert.equal(getDDVStatus(1_700_000).alertLevel, "critical");
    assert.equal(getDDVStatus(2_000_000).mustRegister, false);
    assert.equal(getDDVStatus(2_000_001).mustRegister, true);
    assert.equal(getDDVStatus(2_000_001).alertLevel, "exceeded");
  });
});

describe("helpers", () => {
  it("refuses a currency without a rate instead of treating it as MKD", () => {
    assert.throws(() => getRateToMKD("JPY"));
    assert.equal(getRateToMKD("MKD"), 1);
  });

  it("formats denars the Macedonian way", () => {
    assert.equal(formatMKD(1234567.891), "1.234.567,89 ден.");
  });

  it("uses the calendar date in Skopje, not UTC", () => {
    assert.equal(toSkopjeDate(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
    assert.equal(toSkopjeDate(new Date("2026-07-31T22:30:00Z")), "2026-08-01");
  });

  it("adds and counts days across a year end", () => {
    assert.equal(addDays("2026-12-20", 30), "2027-01-19");
    assert.equal(daysBetween("2026-12-20", "2027-01-19"), 30);
  });
});
