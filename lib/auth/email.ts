// Account emails are case-insensitive: stored trimmed and in lower case, and
// looked up by lower(email), so "Ana@Mail.com" signs in as "ana@mail.com".
// A unique index on lower(email) (migration 0021) keeps one account per
// address whatever the case.

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
