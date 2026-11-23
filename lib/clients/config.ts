// Whether a client is a company (any legal entity, including a sole
// proprietor) or a private person. It decides who reports the income tax on
// what they pay: a company in North Macedonia withholds it, while for a
// private person in North Macedonia, as for any client abroad, the freelancer
// reports it to UJP (see isSelfReportedIncome in lib/tax/calculator.ts).
export const CLIENT_TYPES = ["company", "person"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export const DEFAULT_CLIENT_TYPE: ClientType = "company";

export function isClientType(value: unknown): value is ClientType {
  return (
    typeof value === "string" &&
    (CLIENT_TYPES as readonly string[]).includes(value)
  );
}
