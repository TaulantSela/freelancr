import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveSandbox } from "@/lib/actions/demo";
import { getTranslations } from "@/lib/i18n/server";

// On every app page of a sandbox: it's sample data, it goes after 24 hours,
// and the way to an account of your own (signs out, opens /sign-up).
export async function SandboxBanner() {
  const { t } = await getTranslations();
  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <p className="flex items-start gap-2">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{t.demo.banner}</span>
        </p>
        <form action={leaveSandbox}>
          <Button type="submit" size="sm" variant="outline">
            {t.demo.createOwn}
          </Button>
        </form>
      </div>
    </div>
  );
}
