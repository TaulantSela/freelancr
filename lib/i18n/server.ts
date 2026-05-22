import { cookies } from "next/headers";
import type { Locale } from "./types";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";
import { dictionaries } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value && isLocale(value)) return value;
  return DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export async function getTranslations() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
