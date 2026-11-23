import type { Locale } from "@/lib/i18n/types";

// Every officially assigned ISO 3166-1 alpha-2 code (249), plus XK for
// Kosovo. XK isn't in ISO 3166-1; it's the user-assigned code the EU and
// Kosovo itself use, and Kosovo is a common client country here.
// Names come from Intl.DisplayNames, so nothing here needs translating.
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

// The country the app is built for. Clients here are local; any other
// country is abroad.
export const HOME_COUNTRY: CountryCode = "MK";

export function isCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === "string" &&
    (COUNTRY_CODES as readonly string[]).includes(value)
  );
}

// The options for a country select, North Macedonia first and the rest in
// alphabetical order for the language. Built on the server, so the names
// don't depend on the browser's own copy of the country names.
export function getCountryOptions(locale: Locale): { code: CountryCode; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: "region", fallback: "code" });
  const collator = new Intl.Collator(locale);
  const options = COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code }));
  const home = options.filter((o) => o.code === HOME_COUNTRY);
  const rest = options
    .filter((o) => o.code !== HOME_COUNTRY)
    .sort((a, b) => collator.compare(a.name, b.name));
  return [...home, ...rest];
}
