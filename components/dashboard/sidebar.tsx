"use client";

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
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "@/lib/i18n/client";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/clients", icon: Users, key: "clients" as const },
  { href: "/invoices", icon: FileText, key: "invoices" as const },
  { href: "/payments", icon: Wallet, key: "payments" as const },
  { href: "/settings", icon: Settings, key: "settings" as const },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside className="w-56 shrink-0 border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <FileText className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">{t.common.appName}</span>
        </Link>
      </div>

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
    </aside>
  );
}
