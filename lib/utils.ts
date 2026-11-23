import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return nanoid();
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "sent":
      return "bg-blue-500/10 text-blue-600 border-blue-200";
    case "overdue":
      return "bg-red-500/10 text-red-600 border-red-200";
    case "draft":
      return "bg-zinc-500/10 text-zinc-500 border-zinc-200";
    case "cancelled":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-100";
    default:
      return "bg-zinc-500/10 text-zinc-500 border-zinc-200";
  }
}
