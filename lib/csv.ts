// CSV files as Excel and LibreOffice open them: UTF-8 with a byte order mark
// (so Cyrillic shows), commas, CRLF line endings, and fields quoted per
// RFC 4180 when they hold a comma, a quote or a line break. Numbers are
// plain (a dot, no thousands separators). A text cell that a spreadsheet
// would read as a formula (starting with =, +, -, @, a tab or a carriage
// return) gets a leading apostrophe; numbers never do.

export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

function numberCell(value: number): string {
  if (!Number.isFinite(value)) return "";
  // Up to 8 decimals (exchange rates), without floating-point noise or an
  // exponent (below 1e21): 0.1 + 0.2 -> "0.3", 1000 -> "1000".
  const fixed = value.toFixed(8);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return numberCell(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

// The response for a CSV download.
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
