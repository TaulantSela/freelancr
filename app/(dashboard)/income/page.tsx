import { redirect } from "next/navigation";

// "Income & Tax" became "Payments": what was received, month by month, and
// the tax on it.
export default function IncomePage() {
  redirect("/payments");
}
