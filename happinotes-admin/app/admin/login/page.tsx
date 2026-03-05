"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://happinotes-production.up.railway.app";

type LoginResponse = {
  token?: string;
  user?: { role?: string };
  message?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, password }),
      });
      const data = (await response.json().catch(() => ({}))) as LoginResponse;
      if (!response.ok || !data.token || data.user?.role !== "admin") {
        setError(data.message || "Unable to continue. Check your credentials.");
        return;
      }

      window.localStorage.setItem("admin_token", data.token);
      router.replace("/admin/dashboard");
    } catch {
      setError("Unable to continue. API is unreachable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-2 text-zinc-400">Enter admin credentials to continue.</p>

        <label className="mt-5 block text-sm">
          <span className="mb-1 block text-zinc-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-zinc-300">Password</span>
          <div className="flex gap-2">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-400 disabled:opacity-70"
        >
          {loading ? "Checking..." : "Login"}
        </button>
      </form>
    </main>
  );
}
