import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MobileNav, Sidebar } from "@/components/dashboard/sidebar";
import { SandboxBanner } from "@/components/demo/sandbox-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      <Sidebar userName={session.name} />
      <MobileNav userName={session.name} />
      <main className="flex-1 overflow-auto">
        {session.demoExpiresAt && <SandboxBanner />}
        {children}
      </main>
    </div>
  );
}
