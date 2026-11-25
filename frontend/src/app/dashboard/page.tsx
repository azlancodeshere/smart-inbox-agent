import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";

export const metadata = { title: "Dashboard · Auth Starter" };

export const instant = false;

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
