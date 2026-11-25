import Link from "next/link";

export const metadata = { title: "Auth Starter" };

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600">
          Next.js · Auth.js · Express · Prisma
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to Auth Starter
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Sign up or sign in with Google, GitHub, or your email and password.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
