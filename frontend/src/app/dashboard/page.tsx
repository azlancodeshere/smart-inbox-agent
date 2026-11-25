import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";

export const metadata = { title: "Dashboard · Auth Starter" };

// Cache Components: the session is read at request time, so this route can't
// be prerendered — opt it out (node_modules/next/dist/docs, authentication
// with Cache Components). Without this the build flags the route.
export const instant = false;

/**
 * Protected page — the REAL session check (proxy.ts only checks that a
 * cookie exists). No valid Auth.js session → straight back to /login.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <DashboardClient user={session.user} />
    </main>
  );
}
