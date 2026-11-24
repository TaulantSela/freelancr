import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { epddEntry, epddMonth, type EpddPayment } from "./epdd";

function payment(overrides: Partial<EpddPayment>): EpddPayment {
  return {
    id: "p",
    receivedOn: "2026-10-05",
    currency: "EUR",
    amount: 0,
    fees: 0,
    taxWithheld: 0,
    rateToMKD: 61.5942,
    rateSource: "nbrsm",
    taxTreatment: "self_reported",
    deemedCostsRate: 0,
    clientCountry: "DE",
    ujpStatus: "to_file",
    ...overrides,
  };
}

describe("epddEntry", () => {
  it("reproduces a real UJP calculation: EUR 1,520 with EUR 68.80 Kosovo tax came to 5,176 MKD", () => {
    // пресметка 190826270146 (2026-08-21): UJP converted EUR 1,520 to 93,673
    // MKD and EUR 68 of Kosovo tax to 4,191 MKD; 9,367 − 4,191 = 5,176.
    const e = epddEntry(
      payment({ amount: 1451.2, taxWithheld: 68.8, clientCountry: "XK", rateToMKD: 93673 / 1520 })
    );
    assert.equal(e.amount, 1520);
    assert.equal(e.taxPaidAbroad, 68);
    assert.equal(e.exactTaxPaidAbroad, 68.8);
    assert.equal(e.incomeMKD, 93673);
    assert.equal(e.taxMKD, 9367);
    assert.equal(e.creditMKD, 4191);
    assert.equal(e.owedMKD, 5176);
  });

  it("types what the client paid, fees included, to the nearest whole unit", () => {
    const e = epddEntry(payment({ amount: 899.6, fees: 100, currency: "USD", rateToMKD: 56.0457, clientCountry: "US" }));
    assert.equal(e.exactAmount, 999.6);
    assert.equal(e.amount, 1000);
    assert.equal(e.incomeMKD, 56046);
    assert.equal(e.taxMKD, 5605);
    assert.equal(e.owedMKD, 5605);
    assert.equal(epddEntry(payment({ amount: 1000.5 })).amount, 1001);
    assert.equal(epddEntry(payment({ amount: 1000.49 })).amount, 1000);
  });

  it("rounds the tax paid abroad down, and caps its credit at the tax", () => {
    assert.equal(epddEntry(payment({ amount: 931.01, taxWithheld: 68.99 })).taxPaidAbroad, 68);
    const capped = epddEntry(payment({ amount: 800, taxWithheld: 200 }));
    assert.equal(capped.taxMKD, 6159);
    assert.equal(capped.creditMKD, 6159);
    assert.equal(capped.owedMKD, 0);
  });

  it("has no tax paid abroad for a private person in North Macedonia", () => {
    const e = epddEntry(payment({ amount: 5000, currency: "MKD", rateToMKD: 1, clientCountry: "MK" }));
    assert.equal(e.amount, 5000);
    assert.equal(e.exactTaxPaidAbroad, 0);
    assert.equal(e.taxMKD, 500);
    assert.equal(e.owedMKD, 500);
  });

  it("applies deemed costs in whole denars", () => {
    const e = epddEntry(payment({ amount: 500, deemedCostsRate: 0.2, clientCountry: "AT" }));
    assert.equal(e.incomeMKD, 30797);
    assert.equal(e.baseMKD, 24638);
    assert.equal(e.taxMKD, 2464);
  });
});

describe("epddMonth", () => {
  it("has one entry per self-reported payment, in the order they arrived", () => {
    const { entries, owedMKD } = epddMonth([
      payment({ id: "late", receivedOn: "2026-10-20", amount: 500 }),
      payment({ id: "company", receivedOn: "2026-10-01", amount: 9000, taxWithheld: 1000, currency: "MKD", rateToMKD: 1, clientCountry: "MK", taxTreatment: "withheld" }),
      payment({ id: "early", receivedOn: "2026-10-03", amount: 1000 }),
    ]);
    assert.deepEqual(entries.map((e) => e.paymentId), ["early", "late"]);
    assert.equal(owedMKD, 6159 + 3080);
  });
});
