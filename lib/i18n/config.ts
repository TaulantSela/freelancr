export const LOCALES = ["en", "mk", "sq"] as const;

export const LOCALE_COOKIE = "freelancr_locale";

export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  en: "English",
  mk: "Македонски",
  sq: "Shqip",
};

export const DEFAULT_LOCALE = "mk" as const;

export function isLocale(value: string): value is (typeof LOCALES)[number] {
  return LOCALES.includes(value as (typeof LOCALES)[number]);
}
