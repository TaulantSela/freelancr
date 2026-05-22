"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./types";

type I18nContextValue = {
  locale: Locale;
  t: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, t: dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useTranslations() {
  return useI18n().t;
}

/** Replace {key} placeholders in translation strings */
export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}
