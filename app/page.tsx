import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/i18n/server";
import {
  FileText,
  TrendingUp,
  Bell,
  Shield,
  Globe,
  ArrowRight,
  Check,
  Banknote,
  AlertTriangle,
  Calendar,
} from "lucide-react";

const FEATURE_ICONS = [FileText, Shield, Calendar, TrendingUp, Banknote, Globe, Bell];

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
            <Link href="#pricing" className="hover:text-foreground transition-colors">
              {t.nav.pricing}
            </Link>
            <Link href="#compliance" className="hover:text-foreground transition-colors">
              {t.nav.compliance}
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
              {t.landing.startFree} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline">{t.landing.signInAccount}</Button>
          </Link>
        </div>
        <div className="mt-12 inline-flex items-center gap-3 bg-warning/10 border border-warning/30 text-warning-foreground rounded-lg px-5 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <span>
            <strong className="text-yellow-400">{t.landing.eFakturaAlert}</strong>{" "}
            <span className="text-muted-foreground">{t.landing.eFakturaAlertDetail}</span>
          </span>
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-2xl font-semibold mb-3">{t.landing.featuresTitle}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">{t.landing.featuresSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
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

      <Separator className="max-w-6xl mx-auto" />

      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-2xl font-semibold mb-3">{t.landing.pricingTitle}</h2>
          <p className="text-muted-foreground text-sm">{t.landing.pricingSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {t.landing.plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`rounded-lg border p-6 flex flex-col ${
                i === 1
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <Badge className="self-start mb-3 text-xs">{plan.popular}</Badge>
              )}
              <div className="mb-1">
                <span className="text-lg font-semibold">{plan.name}</span>
              </div>
              <div className="mb-1">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm ml-1">/{plan.period}</span>
              </div>
              {plan.eur && (
                <div className="text-xs text-muted-foreground mb-3">{plan.eur}</div>
              )}
              <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button className="w-full" variant={i === 1 ? "default" : "outline"}>
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <Separator className="max-w-6xl mx-auto" />

      <section id="compliance" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-4 text-xs text-yellow-500 border-yellow-500/30">
              {t.landing.eFakturaAlert}
            </Badge>
            <h2 className="text-2xl font-semibold mb-4 leading-tight">{t.landing.complianceTitle}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {t.landing.complianceSubtitle}
            </p>
            <ul className="space-y-3 mb-8">
              {t.landing.complianceBullets.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button className="gap-2">
                {t.landing.checkStatus} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t.landing.compliancePreview}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{t.dashboard.annualIncomeMkd}</span>
                <span className="font-mono text-yellow-400">1,450,000 ден.</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: "72.5%" }} />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              {t.landing.complianceRows.map((row, i) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span
                    className={
                      i >= 2
                        ? "text-yellow-400 font-mono text-xs"
                        : "text-emerald-400 font-mono text-xs"
                    }
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
