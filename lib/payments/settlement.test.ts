import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { invoiceStanding, settledAmount, settlementStatus } from "./settlement";
import { taxTreatmentFor } from "./config";

const paid = (amount: number, fees = 0, taxWithheld = 0, receivedOn = "2026-10-10") => ({
  amount,
  fees,
  taxWithheld,
  receivedOn,
});

describe("settlement", () => {
  it("counts fees and tax withheld toward the invoice: the client paid them", () => {
    assert.equal(settledAmount([paid(900, 100)]), 1000);
    assert.equal(settlementStatus(1000, [paid(900, 0, 100)]).status, "paid");
    assert.equal(settlementStatus(1000, [paid(900, 100)]).status, "paid");
  });

  it("is paid on the day of the last payment once they cover the total", () => {
    const s = settlementStatus(1000, [paid(400, 0, 0, "2026-10-01"), paid(600, 0, 0, "2026-10-20")]);
    assert.deepEqual(s, { status: "paid", paidAt: "2026-10-20" });
    assert.deepEqual(settlementStatus(1000, [paid(999)]), { status: "sent", paidAt: null });
  });

  it("lowers what's due by its credit notes", () => {
    assert.equal(settlementStatus(1000, [paid(700)], 300).status, "paid");
  });
});

describe("invoiceStanding", () => {
  const invoice = { status: "sent", total: 1000, dueDate: "2026-10-31" };
  it("shows issued, partly paid, overdue, paid and overpaid", () => {
    assert.equal(invoiceStanding(invoice, 0, "2026-10-15").status, "issued");
    assert.equal(invoiceStanding(invoice, 400, "2026-10-15").status, "partly_paid");
    assert.equal(invoiceStanding(invoice, 400, "2026-11-01").status, "overdue");
    assert.equal(invoiceStanding(invoice, 400, "2026-11-01").balance, 600);
    assert.equal(invoiceStanding(invoice, 1000, "2026-11-01").status, "paid");
    assert.equal(invoiceStanding(invoice, 1100, "2026-11-01").overpaid, 100);
  });

  it("is credited when credit notes cover all of it and nothing was paid", () => {
    assert.equal(invoiceStanding(invoice, 0, "2026-11-01", 1000).status, "credited");
  });

  it("keeps drafts and cancelled invoices as they are", () => {
    assert.equal(invoiceStanding({ ...invoice, status: "draft" }, 0, "2026-11-01").status, "draft");
    assert.equal(invoiceStanding({ ...invoice, status: "cancelled" }, 0, "2026-11-01").status, "cancelled");
  });
});

describe("taxTreatmentFor", () => {
  it("decides who deals with the tax on a payment", () => {
    assert.equal(taxTreatmentFor("self_employed", { country: "DE", clientType: "company" }), "business");
    assert.equal(taxTreatmentFor("paid_from_abroad", { country: "MK", clientType: "company" }), "withheld");
    assert.equal(taxTreatmentFor("paid_from_abroad", { country: "MK", clientType: "person" }), "self_reported");
    assert.equal(taxTreatmentFor("paid_from_abroad", { country: "DE", clientType: "company" }), "self_reported");
  });
});
