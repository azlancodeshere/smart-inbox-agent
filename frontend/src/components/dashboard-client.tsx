"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ApiUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  createdAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function DashboardClient({ user }: { user: User }) {
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {

        const tokenRes = await fetch("/api/session/token");
        if (!tokenRes.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const { token } = (await tokenRes.json()) as { token: string };

const res = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setMessage(body.error || `Request failed (${res.status})`);
            setStatus("error");
          }
          return;
        }

        const data = (await res.json()) as { user: ApiUser };
        if (!cancelled) {
          setApiUser(data.user);
          setStatus("ok");
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : "Network error");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-6 grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Session (from Auth.js)
        </h2>
        <div className="mt-3 flex items-center gap-4">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? "avatar"}
              className="h-12 w-12 rounded-full border border-slate-200"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
              {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-900">{user.name ?? "Unnamed user"}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-5 inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign out
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Protected API · Express + Prisma
        </h2>
        {status === "loading" && (
          <p className="mt-3 text-sm text-slate-500">Fetching {API_URL}/api/me …</p>
        )}
        {status === "ok" && apiUser && (
          <div className="mt-3 grid gap-2 text-sm">
            <Row label="id" value={apiUser.id} />
            <Row label="name" value={apiUser.name ?? "—"} />
            <Row label="email" value={apiUser.email ?? "—"} />
            <Row label="createdAt" value={new Date(apiUser.createdAt).toLocaleString()} />
          </div>
        )}
        {status === "error" && (
          <div className="mt-3">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {message || "Could not reach the API."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Make sure the Express server is running on {API_URL}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-slate-400">{label}</span>
      <span className="break-all font-medium text-slate-700">{value}</span>
    </div>
  );
}
