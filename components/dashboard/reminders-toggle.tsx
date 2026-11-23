"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setRemindersEnabled } from "@/lib/actions/settings";
import { useTranslations } from "@/lib/i18n/client";

// "Email me before UJP deadlines". Shown disabled, with the reason, when
// email can't go out (not set up, or the demo account).
export function RemindersToggle({
  enabled,
  disabledReason,
}: {
  enabled: boolean;
  disabledReason: string | null;
}) {
  const t = useTranslations();
  const r = t.settings.reminders;
  const [checked, setChecked] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const disabled = disabledReason !== null || pending;
  return (
    <div className="space-y-2">
      <label className={`flex items-start gap-3 text-sm ${disabledReason ? "opacity-60" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="mt-0.5 accent-primary"
          checked={disabledReason ? false : checked}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            startTransition(async () => {
              const result = await setRemindersEnabled(next);
              if ("errorKey" in result) {
                setChecked(!next);
                toast.error(result.errorKey === "demo" ? t.common.demoUnavailable : r.notConfigured);
              } else toast.success(r.saved);
            });
          }}
        />
        <span>
          <span className="font-medium">{r.toggle}</span>
          <span className="block text-xs text-muted-foreground">{r.hint}</span>
        </span>
      </label>
      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
    </div>
  );
}
