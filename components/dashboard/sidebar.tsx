"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Wallet,
  Menu,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "@/lib/i18n/client";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/clients", icon: Users, key: "clients" as const },
  { href: "/invoices", icon: FileText, key: "invoices" as const },
  { href: "/payments", icon: Wallet, key: "payments" as const },
  { href: "/settings", icon: Settings, key: "settings" as const },
];

function Brand() {
  const t = useTranslations();
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
        <FileText className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
      <span className="font-semibold text-sm">{t.common.appName}</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations();
  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {navItems.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {t.nav[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ userName }: { userName: string }) {
  const t = useTranslations();
  return (
    <div className="p-3 border-t border-border space-y-2">
      <div className="px-3">
        <LanguageSwitcher compact />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium uppercase">
          {userName.slice(0, 2)}
        </div>
        <span className="text-sm text-muted-foreground truncate flex-1">{userName}</span>
      </div>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-3 px-3"
        >
          <LogOut className="h-4 w-4" />
          {t.common.signOut}
        </Button>
      </form>
    </div>
  );
}

// The sidebar on wider screens.
export function Sidebar({ userName }: { userName: string }) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border flex-col h-full">
      <div className="p-4 border-b border-border">
        <Brand />
      </div>
      <NavLinks />
      <Account userName={userName} />
    </aside>
  );
}

// On phones: a top bar, with the same links in a sheet.
export function MobileNav({ userName }: { userName: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden flex items-center justify-between h-12 shrink-0 px-4 border-b border-border">
      <Brand />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t.nav.menu}>
              <Menu className="h-4 w-4" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 gap-0 p-0">
          <SheetTitle className="p-4 border-b border-border text-sm">{t.common.appName}</SheetTitle>
          <NavLinks onNavigate={() => setOpen(false)} />
          <Account userName={userName} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
