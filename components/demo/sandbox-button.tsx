"use client";

import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startSandbox, type SandboxState } from "@/lib/actions/demo";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// "Try it with sample data": opens a sandbox account (lib/demo/sandbox.ts)
// and lands on its dashboard. Says so when the demo is busy.
export function SandboxButton({
  size = "lg",
  variant = "default",
  wide = false,
  className,
}: {
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline";
  // The button takes the form's whole width.
  wide?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<SandboxState, FormData>(startSandbox, null);
  return (
    <form action={action} className={cn("flex flex-col items-center gap-2", className)}>
      <Button
        type="submit"
        size={size}
        variant={variant}
        disabled={pending}
        className={cn("gap-2", wide && "w-full")}
        data-demo="sandbox"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? t.demo.preparing : t.demo.tryButton}
      </Button>
      {state?.errorKey === "busy" && (
        <p role="alert" className="text-sm text-destructive">
          {t.demo.busy}
        </p>
      )}
    </form>
  );
}
