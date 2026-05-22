"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/types";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeLanguage(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        compact ? "text-xs" : "text-sm"
      )}
      aria-label="Language"
    >
      {!compact && <Globe className="h-3.5 w-3.5 text-muted-foreground mr-1" />}
      {LOCALES.map((loc, i) => (
        <span key={loc} className="flex items-center">
          {i > 0 && <span className="text-muted-foreground/40 mx-0.5">|</span>}
          <button
            type="button"
            disabled={pending}
            onClick={() => changeLanguage(loc)}
            className={cn(
              "px-1.5 py-0.5 rounded transition-colors",
              locale === loc
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
              pending && "opacity-50"
            )}
          >
            {compact ? loc.toUpperCase() : LOCALE_LABELS[loc]}
          </button>
        </span>
      ))}
    </div>
  );
}
