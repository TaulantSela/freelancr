import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims and lowercases, so the case someone types doesn't matter", () => {
    assert.equal(normalizeEmail("  Ana.Petrova@Gmail.COM "), "ana.petrova@gmail.com");
    assert.equal(normalizeEmail("ДЕМО@Пример.мк"), "демо@пример.мк");
  });
  it("turns a missing value into an empty string", () => {
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(undefined), "");
  });
});
