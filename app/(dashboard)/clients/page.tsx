import { getSession } from "@/lib/auth/session";
import { getDb, clients, invoices } from "@/lib/db";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Globe, Mail } from "lucide-react";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { getTranslations } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) return null;

  const { t } = await getTranslations();

  const clientList = await getDb()
    .select({
      id: clients.id,
      name: clients.name,
      clientType: clients.clientType,
      email: clients.email,
      country: clients.country,
      currency: clients.currency,
      taxId: clients.taxId,
      contactPerson: clients.contactPerson,
    })
    .from(clients)
    .where(eq(clients.userId, session.userId));

  const invoiceCounts = await Promise.all(
    clientList.map((c) =>
      getDb()
        .select({ cnt: count() })
        .from(invoices)
        .where(eq(invoices.clientId, c.id))
        .then((rows) => rows[0])
    )
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t.clients.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMessage(t.clients.count, { count: clientList.length })}
          </p>
        </div>
        <Link href="/clients/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {t.clients.addClient}
          </Button>
        </Link>
      </div>

      {clientList.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-sm font-medium mb-2">{t.clients.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">{t.clients.emptyDesc}</p>
            <Link href="/clients/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> {t.clients.addFirst}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clientList.map((client, i) => (
            <Card key={client.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium uppercase shrink-0">
                    {client.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{client.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">{client.currency}</Badge>
                      <Badge variant="outline" className="text-xs">{client.country}</Badge>
                      {client.clientType === "person" && (
                        <Badge variant="outline" className="text-xs">
                          {t.clients.types.person}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {client.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {client.email}
                        </span>
                      )}
                      {client.taxId && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {client.taxId}
                        </span>
                      )}
                      {client.contactPerson && (
                        <span>{t.clients.contact}: {client.contactPerson}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground mr-2">
                    <div className="font-medium text-foreground">{invoiceCounts[i]?.cnt ?? 0}</div>
                    <div>{t.clients.invoiceCount}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/clients/${client.id}/edit`}>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        {t.common.edit}
                      </Button>
                    </Link>
                    <DeleteClientButton
                      id={client.id}
                      name={client.name}
                      invoiceCount={invoiceCounts[i]?.cnt ?? 0}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
