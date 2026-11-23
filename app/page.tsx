import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/i18n/server";
import {
  FileText,
  TrendingUp,
  Shield,
  ArrowRight,
  Calendar,
} from "lucide-react";

const FEATURE_ICONS = [FileText, Shield, Calendar, TrendingUp];

export default async function LandingPage() {
  const { t } = await getTranslations();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">{t.common.appName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">
              {t.nav.features}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">{t.nav.signIn}</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">{t.nav.getStarted}</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="outline" className="mb-6 text-xs font-normal text-muted-foreground">
          {t.landing.badge}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          {t.landing.heroTitle}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t.landing.heroSubtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2">
              {t.landing.createAccount} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">{t.landing.signInAccount}</Button>
          </Link>
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-2xl font-semibold mb-3">{t.landing.featuresTitle}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">{t.landing.featuresSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {t.landing.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={f.title} className="bg-card border border-border rounded-lg p-5">
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

      <section className="bg-card border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold mb-4">{t.landing.ctaTitle}</h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">{t.landing.ctaSubtitle}</p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2">
              {t.landing.ctaButton} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/80 flex items-center justify-center">
              <FileText className="h-3 w-3 text-primary-foreground" />
            </div>
            <span>{t.common.appName}</span>
          </div>
          <span>{t.landing.footerTagline}</span>
          <div>© 2026 Freelancr</div>
        </div>
      </footer>
    </div>
  );
}
