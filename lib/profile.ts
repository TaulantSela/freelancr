// Checks and readings of the business profile that goes on invoices.

function compact(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

// Shaped like an IBAN: country code, two check digits, 11-30 letters/digits.
export function isIbanLike(value: string | null | undefined): boolean {
  return !!value && /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(compact(value));
}

// A valid IBAN: the right shape and the ISO 13616 mod-97 check.
export function isValidIban(value: string): boolean {
  const iban = compact(value);
  if (!isIbanLike(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

// "mk07300000012345678" -> "MK07 3000 0001 2345 678" (groups of four).
export function formatIban(value: string): string {
  return compact(value).replace(/(.{4})(?=.)/g, "$1 ");
}

// Whether a value looks like a personal ID number (ЕМБГ / JMBG): 13 digits,
// starting with a real date of birth (DDMMYYY) and with a valid control
// digit. The app never asks for or prints one, so the tax number, VAT number
// and client tax ID fields refuse it. A company or self-employed tax number
// (ЕДБ) starts with 4, which is never a valid day, so it can't match.
export function looksLikeEmbg(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/^MK/i, "").replace(/[\s-]/g, "");
  if (!/^[0-9]{13}$/.test(digits)) return false;
  const d = [...digits].map(Number);
  const day = d[0] * 10 + d[1];
  const month = d[2] * 10 + d[3];
  const yyy = d[4] * 100 + d[5] * 10 + d[6];
  const year = yyy >= 800 ? 1000 + yyy : 2000 + yyy;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1
  ) {
    return false;
  }
  const sum =
    7 * (d[0] + d[6]) +
    6 * (d[1] + d[7]) +
    5 * (d[2] + d[8]) +
    4 * (d[3] + d[9]) +
    3 * (d[4] + d[10]) +
    2 * (d[5] + d[11]);
  const m = 11 - (sum % 11);
  return d[12] === (m > 9 ? 0 : m);
}

export type BankDetails = {
  bankName: string | null;
  // The local account number, for clients in North Macedonia.
  accountNumber: string | null;
  iban: string | null;
  bic: string | null;
};

// users.bank_account was labelled "Bank account (IBAN)" before users.iban
// existed, so an IBAN-looking value there is read as the IBAN (until the
// user saves Settings, which stores the two apart).
export function resolveBankDetails(user: {
  bankName: string | null;
  bankAccount: string | null;
  iban: string | null;
  bic: string | null;
}): BankDetails {
  const legacyIban = isIbanLike(user.bankAccount) ? user.bankAccount : null;
  return {
    bankName: user.bankName || null,
    accountNumber: legacyIban ? null : user.bankAccount || null,
    iban: user.iban || legacyIban,
    bic: user.bic || null,
  };
}
