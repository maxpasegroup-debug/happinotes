"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://happinotes-production.up.railway.app";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const token = window.localStorage.getItem("admin_token");
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      try {
        const res = await fetch(`${BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) as {
          user?: { role?: string; email?: string };
        };
        if (!res.ok || data.user?.role !== "admin") {
          window.localStorage.removeItem("admin_token");
          router.replace("/admin/login");
          return;
        }
        if (!cancelled) {
          setEmail(data.user?.email || "");
        }
      } catch {
        window.localStorage.removeItem("admin_token");
        router.replace("/admin/login");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem("admin_token");
              router.replace("/admin/login");
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            Logout
          </button>
        </div>
        <p className="mt-2 text-zinc-400">{email ? `Signed in as ${email}` : "Loading admin session..."}</p>
      </div>
    </main>
  );
}
