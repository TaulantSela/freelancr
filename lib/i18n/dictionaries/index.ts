import type { Locale } from "../types";
import { en } from "./en";
import { mk } from "./mk";
import { sq } from "./sq";

export const dictionaries: Record<Locale, typeof en> = {
  en,
  mk,
  sq,
};
