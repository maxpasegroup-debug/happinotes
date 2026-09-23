"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app";

type Payload = { token?: string; user?: { role?: string }; message?: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@happinotes.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!email.trim() || !password) throw new Error("Enter the admin email and password.");
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok || !data.token || data.user?.role !== "admin") {
        throw new Error(data.message || "Only the configured administrator can access this website.");
      }
      window.localStorage.setItem("admin_token", data.token);
      router.replace("/admin/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-xl border border-white/15 bg-[#222] px-3 py-3 text-white outline-none placeholder:text-white/45";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] p-6 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#ff7a66]">HappiNotes</p>
        <h1 className="mt-2 text-2xl font-bold">Admin access</h1>
        <p className="mt-2 text-sm text-white/60">Sign in to manage books, episodes, users, and notifications.</p>
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-white/75" htmlFor="admin-email">Admin email</label>
          <input id="admin-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" placeholder="admin@happinotes.in" className={input} />
          <label className="block text-sm font-medium text-white/75" htmlFor="admin-password">Password</label>
          <input id="admin-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Enter admin password" className={input} />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-[#ff735f] px-4 py-3 font-semibold text-white disabled:opacity-60">
          {loading ? "Signing in..." : "Admin login"}
        </button>
      </form>
    </main>
  );
}
