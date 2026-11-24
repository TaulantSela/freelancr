import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SandboxButton } from "@/components/demo/sandbox-button";
import { DemoPlayer } from "@/components/demo/demo-player";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { DEMO_SCRIPT } from "@/lib/demo/script";
import type { Locale } from "@/lib/i18n/types";
import en from "@/public/demo/en/chapters.json";
import mk from "@/public/demo/mk/chapters.json";
import sq from "@/public/demo/sq/chapters.json";

// Written by scripts/record-demo.mts with each language's video.
type Recording = { duration: number; webm: boolean; chapters: { id: string; start: number }[] };
const RECORDINGS: Record<Locale, Recording> = { en, mk, sq };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: `${t.demo.pageTitle} · Freelancr`, description: t.demo.metaDescription };
}

// "How Freelancr works": the walkthrough video in the visitor's language
// with its chapters, the same steps written out with a screenshot each,
// and the ways in. Public.
export default async function DemoPage() {
  const [{ locale, t }, session] = await Promise.all([getTranslations(), getSession()]);
  const script = DEMO_SCRIPT[locale];
  const recording = RECORDINGS[locale];
  const dir = `/demo/${locale}`;
  const chapters = script.chapters.map((c, i) => ({
    ...c,
    number: i + 1,
    start: recording.chapters.find((r) => r.id === c.id)?.start ?? 0,
  }));
  const steps = chapters.filter((c) => c.guide.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        <section className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t.demo.pageTitle}</h1>
            <p className="text-muted-foreground leading-relaxed">{t.demo.pageIntro}</p>
          </div>
          <DemoPlayer
            mp4={`${dir}/walkthrough.mp4`}
            webm={recording.webm ? `${dir}/walkthrough.webm` : null}
            poster={`${dir}/poster.webp`}
            chapters={chapters.map(({ id, title, start }) => ({ id, title, start }))}
            labels={{ chapters: t.demo.chapters, fallback: t.demo.videoFallback }}
          />
        </section>

        <section className="space-y-12" aria-labelledby="guide">
          <h2 id="guide" className="text-2xl font-semibold">{t.demo.guide}</h2>
          {steps.map((c, i) => (
            <article
              key={c.id}
              id={c.id}
              className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-8 items-start"
            >
              <Image
                src={`${dir}/step-${c.number}.webp`}
                alt={c.title}
                width={1600}
                height={1000}
                unoptimized
                className="w-full h-auto rounded-lg border border-border"
              />
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  {formatMessage(t.demo.step, { n: i + 1 })}
                </p>
                <h3 className="text-lg font-semibold">{c.title}</h3>
                {c.guide.map((paragraph) => (
                  <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        {/* Signed in, the header offers the dashboard instead: a sandbox
            started from here would replace the session. */}
        {!session && (
          <section className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold mb-3">{t.demo.endTitle}</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">{t.demo.endText}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center sm:items-start">
              <SandboxButton />
              <Link href="/sign-up">
                <Button size="lg" variant="outline" className="gap-2">
                  {t.demo.createAccount} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-border">
        <p className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-muted-foreground leading-relaxed">
          {t.landing.disclaimer}
        </p>
      </footer>
    </div>
  );
}
