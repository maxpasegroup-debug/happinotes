"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type LoginResponse = {
  token?: string;
  user?: { role?: string };
  message?: string;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      const response = await apiRequest<LoginResponse>("/auth/login", "POST", {
        email: normalized,
        password,
      });
      if (!response.token || response.user?.role !== "admin") {
        setError(response.message || "Unable to continue. Check your credentials.");
        return;
      }
      window.localStorage.setItem("admin_token", response.token);
      router.replace("/admin/dashboard");
    } catch {
      setError("Unable to continue. API is unreachable right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#111217",
          border: "1px solid #25262d",
          borderRadius: 14,
          padding: 22,
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 14 }}>Admin Login</h1>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div style={{ marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #31323a", background: "#090a0f", color: "#fff" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 14 }}>
          <div style={{ marginBottom: 6 }}>Password</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #31323a", background: "#090a0f", color: "#fff" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                borderRadius: 8,
                border: "1px solid #31323a",
                background: "#111217",
                color: "#fff",
                padding: "0 12px",
                fontWeight: 600,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {error ? <div style={{ color: "#fca5a5", marginBottom: 10 }}>{error}</div> : null}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: 0,
            background: "#f97316",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Checking..." : "Login"}
        </button>
      </form>
    </main>
  );
}
