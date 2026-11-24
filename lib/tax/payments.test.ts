import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  owedToUjp,
  paymentTax,
  selfReportedMonths,
  summarizeMonths,
  summarizeYear,
  ujpMonthStatus,
  type TaxPayment,
} from "./payments";

const EUR = 61.5942;
const USD = 56.0457;

function payment(overrides: Partial<TaxPayment>): TaxPayment {
  return {
    id: "p",
    receivedOn: "2026-10-05",
    amount: 0,
    fees: 0,
    taxWithheld: 0,
    rateToMKD: EUR,
    rateSource: "nbrsm",
    taxTreatment: "self_reported",
    deemedCostsRate: 0,
    clientCountry: "DE",
    ujpStatus: "to_file",
    ...overrides,
  };
}

describe("paymentTax", () => {
  it("taxes a payment from abroad at 10% of what arrived, at the day's rate", () => {
    const t = paymentTax(payment({ amount: 1000 }));
    assert.equal(t.receivedMKD, 61594.2);
    assert.equal(t.grossMKD, 61594.2);
    assert.equal(t.taxMKD, 6159.42);
    assert.equal(t.creditMKD, 0);
    assert.equal(t.owedMKD, 6159.42);
  });

  it("counts a platform's fee as income: the client paid it", () => {
    const t = paymentTax(payment({ amount: 900, fees: 100, rateToMKD: USD, clientCountry: "US" }));
    assert.equal(t.receivedMKD, 50441.13);
    assert.equal(t.grossMKD, 56045.7);
    assert.equal(t.owedMKD, 5604.57);
  });

  it("credits tax withheld abroad against the 10% (Art. 8(4))", () => {
    const t = paymentTax(payment({ amount: 900, taxWithheld: 100 }));
    assert.equal(t.grossMKD, 61594.2);
    assert.equal(t.creditMKD, 6159.42);
    assert.equal(t.owedMKD, 0);
  });

  it("caps the credit at the tax due here", () => {
    const t = paymentTax(payment({ amount: 800, taxWithheld: 200 }));
    assert.equal(t.taxMKD, 6159.42);
    assert.equal(t.creditMKD, 6159.42);
    assert.equal(t.owedMKD, 0);
  });

  it("gives no foreign credit for a payer in North Macedonia", () => {
    const t = paymentTax(payment({ amount: 900, taxWithheld: 100, rateToMKD: 1, clientCountry: "MK" }));
    assert.equal(t.taxMKD, 100);
    assert.equal(t.creditMKD, 0);
    assert.equal(t.owedMKD, 100);
  });

  it("applies deemed costs for author's rights (Art. 40)", () => {
    const t = paymentTax(payment({ amount: 500, deemedCostsRate: 0.2, clientCountry: "AT" }));
    assert.equal(t.grossMKD, 30797.1);
    assert.equal(t.baseMKD, 24637.68);
    assert.equal(t.owedMKD, 2463.77);
  });

  it("shows a company in North Macedonia's withholding as already paid (Art. 80)", () => {
    const t = paymentTax(
      payment({ amount: 9000, taxWithheld: 1000, rateToMKD: 1, clientCountry: "MK", taxTreatment: "withheld", ujpStatus: null })
    );
    assert.equal(t.grossMKD, 10000);
    assert.equal(t.alreadyPaidForYouMKD, 1000);
    assert.equal(t.owedMKD, 0);
  });

  it("only tracks income for a registered self-employed person", () => {
    const t = paymentTax(payment({ amount: 1000, fees: 10, taxTreatment: "business", ujpStatus: null }));
    assert.equal(t.grossMKD, 62210.14);
    assert.equal(t.taxMKD, 0);
    assert.equal(t.owedMKD, 0);
  });
});

describe("ujpMonthStatus", () => {
  const reportBy = "2026-11-10";
  const payBy = "2026-11-15";
  it("has nothing without self-reported payments", () => {
    assert.equal(ujpMonthStatus([], reportBy, payBy, "2026-11-01"), "nothing");
  });
  it("is to file until the 10th, then late", () => {
    assert.equal(ujpMonthStatus(["to_file"], reportBy, payBy, "2026-11-10"), "to_file");
    assert.equal(ujpMonthStatus(["to_file"], reportBy, payBy, "2026-11-11"), "late");
    assert.equal(ujpMonthStatus([null], reportBy, payBy, "2026-11-11"), "late");
  });
  it("is filed or approved until the 15th, then late unless paid", () => {
    assert.equal(ujpMonthStatus(["filed"], reportBy, payBy, "2026-11-12"), "filed");
    assert.equal(ujpMonthStatus(["approved", "paid"], reportBy, payBy, "2026-11-12"), "approved");
    assert.equal(ujpMonthStatus(["approved"], reportBy, payBy, "2026-11-16"), "late");
    assert.equal(ujpMonthStatus(["paid", "paid"], reportBy, payBy, "2027-01-01"), "paid");
  });
});

describe("summarizeMonths and owedToUjp", () => {
  const payments = [
    payment({ id: "a", receivedOn: "2026-10-03", amount: 1000, ujpStatus: "to_file" }),
    payment({ id: "b", receivedOn: "2026-10-20", amount: 500, ujpStatus: "to_file" }),
    payment({ id: "c", receivedOn: "2026-09-02", amount: 1000, ujpStatus: "paid" }),
    payment({ id: "d", receivedOn: "2026-12-30", amount: 100, ujpStatus: "to_file" }),
    payment({ id: "e", receivedOn: "2026-10-10", amount: 9000, taxWithheld: 1000, rateToMKD: 1, clientCountry: "MK", taxTreatment: "withheld", ujpStatus: null }),
  ];

  it("groups by month, newest first, with next month's deadlines", () => {
    const months = summarizeMonths(payments, "2026-11-08");
    assert.deepEqual(months.map((m) => m.month), ["2026-12", "2026-10", "2026-09"]);
    const dec = months[0];
    assert.equal(dec.reportBy, "2027-01-10");
    assert.equal(dec.payBy, "2027-01-15");
    const oct = months[1];
    assert.equal(oct.owedMKD, 9239.13);
    assert.equal(oct.alreadyPaidForYouMKD, 1000);
    assert.equal(oct.withheldGrossMKD, 10000);
    assert.equal(oct.status, "to_file");
    assert.equal(months[2].status, "paid");
    assert.equal(months[2].unpaidOwedMKD, 0);
  });

  it("puts a month that missed the 10th among the late ones", () => {
    const months = summarizeMonths(payments, "2026-11-11");
    const owed = owedToUjp(months, "2026-11-11");
    assert.deepEqual(owed.late.map((m) => m.month), ["2026-10"]);
    assert.equal(owed.due, null);
    assert.equal(owed.current, null);
    assert.equal(owed.totalUnpaidMKD, roundTo2(9239.13 + 615.94));
  });

  it("adds up a year with every kind of tax in it", () => {
    const year = summarizeYear(summarizeMonths(payments, "2026-11-11"));
    assert.equal(year.alreadyPaidForYouMKD, 1000);
    assert.equal(year.totalIncomeTaxMKD, roundTo2(year.owedMKD + year.creditMKD + 1000));
  });

  it("lists only the months with self-reported income", () => {
    assert.deepEqual(selfReportedMonths(payments), ["2026-09", "2026-10", "2026-12"]);
  });
});

function roundTo2(x: number): number {
  return Math.round(x * 100) / 100;
}
