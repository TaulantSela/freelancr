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

// The language a client's invoices are written in, whatever language the
// user has the app in. One of the app's languages.
export const INVOICE_LANGUAGES = ["mk", "sq", "en"] as const;
export type InvoiceLanguage = (typeof INVOICE_LANGUAGES)[number];

export function isInvoiceLanguage(value: unknown): value is InvoiceLanguage {
  return (
    typeof value === "string" &&
    (INVOICE_LANGUAGES as readonly string[]).includes(value)
  );
}

// Macedonian for a client in North Macedonia, English for anyone else.
export function defaultInvoiceLanguage(country: string): InvoiceLanguage {
  return country === "MK" ? "mk" : "en";
}

// clients.invoice_language is null only for a client saved by a version of
// the app that didn't ask for it; those get the default for their country.
export function resolveInvoiceLanguage(client: {
  invoiceLanguage: string | null;
  country: string;
}): InvoiceLanguage {
  return isInvoiceLanguage(client.invoiceLanguage)
    ? client.invoiceLanguage
    : defaultInvoiceLanguage(client.country);
}
