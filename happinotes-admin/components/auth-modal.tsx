"use client";

import { FormEvent, useState } from "react";
import { BASE_URL } from "@/lib/content-api";
import { setUserSession } from "@/lib/user-session";

type LoginSignupResponse = {
  token?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: "admin" | "user";
    subscriptionActive?: boolean;
    subscriptionExpiry?: string | null;
  };
  message?: string;
};

export function AuthModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
      const body =
        mode === "signup"
          ? { name: name || email.split("@")[0] || "Happinotes User", email, password }
          : { email, password };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as LoginSignupResponse;
      if (!res.ok || !data.token || !data.user) {
        setError(data?.message || "Unable to continue.");
        return;
      }
      setUserSession(data.token, data.user);
      onSuccess();
      onClose();
    } catch {
      setError("Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141a2a] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {mode === "signup" ? "Sign up to continue" : "Login to continue"}
          </h3>
          <button onClick={onClose} className="text-sm text-[#b7c0d8]">
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-xl border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
            />
          ) : null}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            className="w-full rounded-xl border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
            className="w-full rounded-xl border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
          >
            {loading ? "Please wait..." : mode === "signup" ? "Sign Up" : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((prev) => (prev === "signup" ? "login" : "signup"))}
          className="mt-3 text-sm text-[#b7c0d8]"
        >
          {mode === "signup" ? "Already have an account? Login" : "New here? Create account"}
        </button>
      </div>
    </div>
  );
}
