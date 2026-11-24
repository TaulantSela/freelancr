import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n/server";

// The public pages' header: the landing and /demo. Signed in, it offers
// the dashboard instead of signing in or up.
export async function SiteHeader() {
  const [{ t }, session] = await Promise.all([getTranslations(), getSession()]);
  return (
    <header className="border-b border-border/40 sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">{t.common.appName}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/#features" className="hover:text-foreground transition-colors">
            {t.nav.features}
          </Link>
          <Link href="/demo" className="hover:text-foreground transition-colors">
            {t.nav.howItWorks}
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher compact />
          {session ? (
            <Link href="/dashboard">
              <Button size="sm">{t.nav.dashboard}</Button>
            </Link>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">{t.nav.signIn}</Button>
              </Link>
              <Link href="/sign-up" className="hidden sm:block">
                <Button size="sm">{t.nav.getStarted}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
