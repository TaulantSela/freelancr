"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { updateProfile, type SettingsErrorKey } from "@/lib/actions/settings";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/db/schema";
import { TAX_STATUSES, type TaxStatus } from "@/lib/tax/calculator";
import { resolveBankDetails } from "@/lib/profile";
import { useTranslations } from "@/lib/i18n/client";

type State = { success?: boolean; errorKey?: SettingsErrorKey } | null;

async function updateProfileAction(_prev: State, formData: FormData): Promise<State> {
  const result = await updateProfile(formData);
  if (result && "errorKey" in result) return result;
  return { success: true };
}

// Only what the form shows; never the password hash.
export type SettingsUser = Pick<
  User,
  | "name"
  | "businessName"
  | "taxStatus"
  | "monthlyAdvanceMKD"
  | "vatRegistered"
  | "vatNumber"
  | "taxNumber"
  | "address"
  | "placeOfIssue"
  | "signatoryName"
  | "bankName"
  | "bankAccount"
  | "iban"
  | "bic"
>;

export function SettingsForm({ user }: { user: SettingsUser }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateProfileAction, null);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(user.taxStatus);
  const [vatRegistered, setVatRegistered] = useState(user.vatRegistered);
  // An IBAN saved in the old "Bank account (IBAN)" field shows up as the IBAN.
  const bank = resolveBankDetails(user);

  return (
    <form action={action} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t.settings.fullName}</Label>
          <Input id="name" name="name" defaultValue={user.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessName">{t.settings.businessName}</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={user.businessName ?? ""}
            placeholder={t.settings.businessNamePlaceholder}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">{t.tax.statusLabel}</legend>
        <p className="text-xs text-muted-foreground">{t.tax.statusHint}</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {TAX_STATUSES.map((status) => (
            <label
              key={status}
              className="flex items-start gap-3 rounded-md border border-input px-3 py-2 text-sm cursor-pointer has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="taxStatus"
                value={status}
                checked={taxStatus === status}
                onChange={() => setTaxStatus(status)}
                className="mt-0.5 accent-primary"
              />
              <span className="space-y-0.5">
                <span className="block font-medium">{t.tax.statuses[status]}</span>
                <span className="block text-xs text-muted-foreground">
                  {t.tax.statusDescriptions[status]}
                </span>
              </span>
            </label>
          ))}
        </div>
        {taxStatus === "self_employed" && (
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="monthlyAdvanceMKD">{t.settings.monthlyAdvance}</Label>
            <Input
              id="monthlyAdvanceMKD"
              name="monthlyAdvanceMKD"
              inputMode="decimal"
              defaultValue={user.monthlyAdvanceMKD ?? ""}
              placeholder="0"
              className="font-mono sm:w-1/2"
            />
            <p className="text-xs text-muted-foreground">{t.settings.monthlyAdvanceHint}</p>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <label className="flex items-start gap-3 rounded-md border border-input px-3 py-2 text-sm cursor-pointer has-checked:border-primary has-checked:bg-primary/5">
          <input
            type="checkbox"
            name="vatRegistered"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block font-medium">{t.settings.vatRegistered}</span>
            <span className="block text-xs text-muted-foreground">
              {t.settings.vatRegisteredHint}
            </span>
          </span>
        </label>
        {vatRegistered && (
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="vatNumber">{t.settings.vatNumber}</Label>
            <Input
              id="vatNumber"
              name="vatNumber"
              defaultValue={user.vatNumber ?? ""}
              placeholder="MK4012345678901"
              required
              className="font-mono sm:w-1/2"
            />
          </div>
        )}
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="taxNumber">{t.settings.taxNumber}</Label>
          <Input
            id="taxNumber"
            name="taxNumber"
            defaultValue={user.taxNumber ?? ""}
            placeholder="4012345678901"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{t.settings.taxNumberHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">{t.settings.address}</Label>
          <Input id="address" name="address" defaultValue={user.address ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="placeOfIssue">{t.settings.placeOfIssue}</Label>
          <Input
            id="placeOfIssue"
            name="placeOfIssue"
            defaultValue={user.placeOfIssue ?? ""}
            placeholder={t.settings.placeOfIssuePlaceholder}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signatoryName">{t.settings.signatoryName}</Label>
          <Input
            id="signatoryName"
            name="signatoryName"
            defaultValue={user.signatoryName ?? ""}
            placeholder={user.name}
          />
          <p className="text-xs text-muted-foreground">{t.settings.signatoryNameHint}</p>
        </div>
      </div>

      <Separator />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bankName">{t.settings.bankName}</Label>
          <Input id="bankName" name="bankName" defaultValue={bank.bankName ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iban">{t.settings.iban}</Label>
          <Input
            id="iban"
            name="iban"
            defaultValue={bank.iban ?? ""}
            placeholder="MK07 2501 2000 0058 984"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bic">{t.settings.bic}</Label>
          <Input
            id="bic"
            name="bic"
            defaultValue={bank.bic ?? ""}
            placeholder="KOBSMK2X"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAccount">{t.settings.bankAccount}</Label>
          <Input
            id="bankAccount"
            name="bankAccount"
            defaultValue={bank.accountNumber ?? ""}
            placeholder="300000000123456"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{t.settings.bankAccountHint}</p>
        </div>
      </div>

      {state?.errorKey && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          {t.settings.errors[state.errorKey]}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-500 bg-emerald-500/10 rounded px-3 py-2">
          {t.settings.saved}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.settings.saveChanges}
      </Button>
    </form>
  );
}
