import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getTranslations } from "@/lib/i18n/server";
import { TERMS } from "@/lib/legal/content";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getTranslations();
  return { title: `${TERMS[locale].title} · Freelancr`, description: TERMS[locale].intro };
}

// The terms of use (lib/legal/content.ts). Public.
export default async function TermsPage() {
  const { locale, t } = await getTranslations();
  return <LegalPage doc={TERMS[locale]} locale={locale} other={{ href: "/privacy", label: t.legal.privacy }} />;
}
