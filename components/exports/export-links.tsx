"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";

// CSV downloads for a year picked here: the invoices and the credit notes.
export function InvoiceExportLinks({ years }: { years: number[] }) {
  const t = useTranslations();
  const e = t.exports;
  const [year, setYear] = useState(years[0]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={e.yearLabel}
        value={year}
        onChange={(ev) => setYear(Number(ev.target.value))}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        {years.map((y) => (
          <option key={y} value={y} className="bg-card">
            {y}
          </option>
        ))}
      </select>
      <a href={`/api/export/invoices?year=${year}`} download>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> {e.invoicesCsv}
        </Button>
      </a>
      <a href={`/api/export/credit-notes?year=${year}`} download>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> {e.creditNotesCsv}
        </Button>
      </a>
    </div>
  );
}
