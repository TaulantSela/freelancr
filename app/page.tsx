import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/site-header";
import { SandboxButton } from "@/components/demo/sandbox-button";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";
import {
  FileText,
  Wallet,
  Landmark,
  Gauge,
  FolderOpen,
  ArrowRight,
  PlayCircle,
} from "lucide-react";

const FEATURE_ICONS = [FileText, Wallet, Landmark, Gauge, FolderOpen];

// Signed in (an account or a sandbox), the ways in give way to the
// dashboard: a sandbox started from here would replace the session.
export default async function LandingPage() {
  const [{ t }, session] = await Promise.all([getTranslations(), getSession()]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-20 text-center">
        <Badge variant="outline" className="mb-6 text-xs font-normal text-muted-foreground">
          {t.landing.badge}
        </Badge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          {t.landing.heroTitle}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t.landing.heroSubtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center sm:items-start">
          {session ? (
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                {t.nav.dashboard} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <SandboxButton />
              <Link href="/sign-up">
                <Button size="lg" variant="outline" className="gap-2">
                  {t.demo.createAccount} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
          <Link href="/demo">
            <Button size="lg" variant="ghost" className="gap-2">
              <PlayCircle className="h-4 w-4" /> {t.demo.seeHow}
            </Button>
          </Link>
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-2xl font-semibold mb-12 text-center">{t.landing.featuresTitle}</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {t.landing.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? FileText;
            const last = i === t.landing.features.length - 1 && t.landing.features.length % 2 === 1;
            return (
              <div
                key={f.title}
                className={`bg-card border border-border rounded-lg p-5 ${last ? "md:col-span-2" : ""}`}
              >
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-medium text-sm mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {!session && (
        <section className="bg-card border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold mb-4">{t.landing.ctaTitle}</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">{t.landing.ctaSubtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center sm:items-start">
              <SandboxButton />
              <Link href="/sign-up">
                <Button size="lg" variant="outline" className="gap-2">
                  {t.demo.createAccount} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-4 text-sm text-muted-foreground">
          <p className="text-xs leading-relaxed max-w-3xl">{t.landing.disclaimer}</p>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-primary/80 flex items-center justify-center">
                <FileText className="h-3 w-3 text-primary-foreground" />
              </div>
              <span>{t.common.appName}</span>
            </div>
            <span className="text-center">{t.landing.footerTagline}</span>
            <div>© 2026 Freelancr</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
