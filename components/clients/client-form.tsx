"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/lib/actions/clients";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/client";
import { SUPPORTED_CURRENCIES } from "@/lib/tax/calculator";
import {
  CLIENT_TYPES,
  DEFAULT_CLIENT_TYPE,
  INVOICE_LANGUAGES,
  defaultInvoiceLanguage,
  resolveInvoiceLanguage,
  type ClientType,
  type InvoiceLanguage,
} from "@/lib/clients/config";
import { LOCALE_LABELS } from "@/lib/i18n/config";
import type { Client } from "@/lib/db/schema";

type State = {
  errorKey?: "nameRequired" | "currencyUnsupported" | "countryRequired";
} | null;

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

export function ClientForm({
  client,
  countries,
}: {
  client?: Client;
  // From getCountryOptions(), in the UI language.
  countries: { code: string; name: string }[];
}) {
  const t = useTranslations();
  const isEdit = Boolean(client);

  const [state, action, pending] = useActionState(
    isEdit
      ? updateClientAction.bind(null, client!.id)
      : createClientAction,
    null
  );
  const [clientType, setClientType] = useState<ClientType>(
    client?.clientType ?? DEFAULT_CLIENT_TYPE
  );
  const isPerson = clientType === "person";
  // A new client, or one saved with a code that's no longer offered (the old
  // "OTHER"), starts on an empty choice so the country is picked on purpose.
  const initialCountry = countries.some((c) => c.code === client?.country)
    ? client!.country
    : "";
  // A new client's invoice language follows the country (Macedonian for
  // North Macedonia, English otherwise) until it's picked by hand; an
  // existing client keeps the one on file.
  const [invoiceLanguage, setInvoiceLanguage] = useState<InvoiceLanguage>(
    client ? resolveInvoiceLanguage(client) : defaultInvoiceLanguage(initialCountry)
  );
  const [languagePicked, setLanguagePicked] = useState(isEdit);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">{t.clients.form.clientType}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {CLIENT_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 rounded-md border border-input px-3 py-2 text-sm cursor-pointer has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="clientType"
                value={type}
                checked={clientType === type}
                onChange={() => setClientType(type)}
                className="accent-primary"
              />
              {t.clients.types[type]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t.clients.form.clientTypeHint}</p>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            {isPerson ? t.clients.form.personName : t.clients.form.name}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder={isPerson ? undefined : "Acme Corp"}
            defaultValue={client?.name}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.clients.form.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={isPerson ? undefined : "billing@acme.com"}
            defaultValue={client?.email ?? ""}
          />
        </div>
      </div>

      {/* A private person has no contact person, and their only identifier
          would be the personal ID number (ЕМБГ), which the app never asks
          for. */}
      {!isPerson && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="contactPerson">{t.clients.form.contactPerson}</Label>
            <Input
              id="contactPerson"
              name="contactPerson"
              defaultValue={client?.contactPerson ?? ""}
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
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">{t.clients.form.country}</Label>
          <select
            name="country"
            id="country"
            required
            defaultValue={initialCountry}
            onChange={(e) => {
              if (!languagePicked) setInvoiceLanguage(defaultInvoiceLanguage(e.target.value));
            }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="" disabled className="bg-card">
              {t.clients.form.chooseCountry}
            </option>
            {countries.map(({ code, name }) => (
              <option key={code} value={code} className="bg-card">
                {name}
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
        <Label htmlFor="invoiceLanguage">{t.clients.form.invoiceLanguage}</Label>
        <select
          name="invoiceLanguage"
          id="invoiceLanguage"
          value={invoiceLanguage}
          onChange={(e) => {
            setInvoiceLanguage(e.target.value as InvoiceLanguage);
            setLanguagePicked(true);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring sm:w-1/2"
        >
          {INVOICE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-card">
              {LOCALE_LABELS[lang]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t.clients.form.invoiceLanguageHint}</p>
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
