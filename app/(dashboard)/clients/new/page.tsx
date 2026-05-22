import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewClientForm } from "@/components/clients/new-client-form";
import { getTranslations } from "@/lib/i18n/server";

export default async function NewClientPage() {
  const { t } = await getTranslations();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> {t.nav.clients}
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{t.clients.newBreadcrumb}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.clients.newTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
