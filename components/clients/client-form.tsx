"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/lib/actions/clients";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/client";
import { SUPPORTED_CURRENCIES } from "@/lib/tax/calculator";
import type { Client } from "@/lib/db/schema";

const COUNTRY_CODES = ["MK", "US", "DE", "NL", "GB", "FR", "CH", "AU", "CA", "XK", "RS", "HR", "OTHER"] as const;

type State = { errorKey?: "nameRequired" } | null;

async function createClientAction(_prev: State, formData: FormData): Promise<State> {
  const result = await createClient(formData);
  return result ?? null;
}

async function updateClientAction(
  id: string,
  _prev: State,
  formData: FormData
): Promise<State> {
  const result = await updateClient(id, formData);
  return result ?? null;
}

export function ClientForm({ client }: { client?: Client }) {
  const t = useTranslations();
  const isEdit = Boolean(client);

  const [state, action, pending] = useActionState(
    isEdit
      ? updateClientAction.bind(null, client!.id)
      : createClientAction,
    null
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            {t.clients.form.name} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="Acme Corp"
            defaultValue={client?.name}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">{t.clients.form.contactPerson}</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={client?.contactPerson ?? ""}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.clients.form.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="billing@acme.com"
            defaultValue={client?.email ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxId">{t.clients.form.taxId}</Label>
          <Input
            id="taxId"
            name="taxId"
            placeholder="DE123456789"
            defaultValue={client?.taxId ?? ""}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">{t.clients.form.country}</Label>
          <select
            name="country"
            id="country"
            defaultValue={client?.country ?? "US"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code} className="bg-card">
                {t.clients.countries[code]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">{t.clients.form.currency}</Label>
          <select
            name="currency"
            id="currency"
            defaultValue={client?.currency ?? "EUR"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-card">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">{t.clients.form.address}</Label>
        <Input id="address" name="address" defaultValue={client?.address ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.clients.form.notes}</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
      </div>

      {state?.errorKey && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          {t.clients.form[state.errorKey]}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? t.common.save : t.clients.form.submit}
        </Button>
        <Link href="/clients">
          <Button type="button" variant="outline">{t.common.cancel}</Button>
        </Link>
      </div>
    </form>
  );
}
