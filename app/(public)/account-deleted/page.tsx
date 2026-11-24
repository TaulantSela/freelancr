import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";

// Where deleting an account lands (lib/actions/account.ts). Public: the
// session is gone by then.
export default async function AccountDeletedPage() {
  const { t } = await getTranslations();
  const d = t.legal.accountDeleted;
  return (
    <AuthCard appName={t.common.appName} title={d.title} description={d.body}>
      <Link href="/">
        <Button variant="outline" className="w-full">
          {d.home}
        </Button>
      </Link>
    </AuthCard>
  );
}
