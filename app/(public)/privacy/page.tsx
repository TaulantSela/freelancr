import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getTranslations } from "@/lib/i18n/server";
import { PRIVACY } from "@/lib/legal/content";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getTranslations();
  return { title: `${PRIVACY[locale].title} · Freelancr`, description: PRIVACY[locale].intro };
}

// The privacy policy (lib/legal/content.ts). Public.
export default async function PrivacyPage() {
  const { locale, t } = await getTranslations();
  return <LegalPage doc={PRIVACY[locale]} locale={locale} other={{ href: "/terms", label: t.legal.terms }} />;
}
