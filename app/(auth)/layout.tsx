import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// Signed in (with a current session): straight to the dashboard.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/dashboard");
  return children;
}
