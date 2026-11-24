import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { formatMessage } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/types";
import { LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, type LegalDocument } from "@/lib/legal/content";

const DATE_LOCALES: Record<Locale, string> = { en: "en-GB", mk: "mk-MK", sq: "sq-AL" };

// "24 November 2026". Server-rendered only, so Node's full ICU data is there
// for Macedonian and Albanian month names.
function formatUpdated(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

// Text with the contact address turned into a mailto link.
function WithContact({ text }: { text: string }) {
  const parts = text.split(LEGAL_CONTACT_EMAIL);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          )}
        </span>
      ))}
    </>
  );
}

// The privacy policy or the terms, in the visitor's language, with a link to
// the other one.
export function LegalPage({
  doc,
  locale,
  other,
}: {
  doc: LegalDocument;
  locale: Locale;
  other: { href: string; label: string };
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">
              {formatMessage(doc.updated, { date: formatUpdated(LEGAL_UPDATED, locale) })}
            </p>
            <p className="text-muted-foreground leading-relaxed">{doc.intro}</p>
          </header>
          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              {section.bullets && (
                <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {section.bullets.map((b) => (
                    <li key={b}>
                      <WithContact text={b} />
                    </li>
                  ))}
                </ul>
              )}
              {section.paragraphs?.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                  <WithContact text={p} />
                </p>
              ))}
            </section>
          ))}
          <footer className="border-t border-border pt-6 text-sm">
            <Link href={other.href} className="text-primary hover:underline">
              {other.label}
            </Link>
          </footer>
        </article>
      </main>
    </div>
  );
}
