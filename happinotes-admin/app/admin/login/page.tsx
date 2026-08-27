"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app";
type Step = "details" | "otp";
type Payload = { loginChallenge?: string; testOtp?: string; token?: string; user?: { role?: string }; message?: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [challenge, setChallenge] = useState("");
  const [testOtp, setTestOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const clean = () => phone.replace(/\s/g, "");
  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      if (step === "details") {
        if (!/^\+[1-9]\d{7,14}$/.test(clean())) throw new Error("Enter the admin WhatsApp number with country code.");
        const res = await fetch(`${BASE_URL}/auth/request-login-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: clean() }) });
        const data = await res.json().catch(() => ({})) as Payload; if (!res.ok) throw new Error(data.message || "Could not send OTP.");
        setTestOtp(data.testOtp || ""); setStep("otp"); return;
      }
      if (!challenge) {
        if (!/^\d{6}$/.test(otp)) throw new Error("Enter the 6-digit OTP.");
        const res = await fetch(`${BASE_URL}/auth/verify-login-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: clean(), otp }) });
        const data = await res.json().catch(() => ({})) as Payload; if (!res.ok || !data.loginChallenge) throw new Error(data.message || "Invalid or expired OTP."); setChallenge(data.loginChallenge); setOtp(""); return;
      }
      if (!/^\d{6}$/.test(pin)) throw new Error("Enter the 6-digit PIN.");
      const res = await fetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: clean(), pin, loginChallenge: challenge }) });
      const data = await res.json().catch(() => ({})) as Payload; if (!res.ok || !data.token || data.user?.role !== "admin") throw new Error(data.message || "This account is not an administrator.");
      window.localStorage.setItem("admin_token", data.token); router.replace("/admin/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue."); } finally { setLoading(false); }
  }
  const input = "w-full rounded-xl border border-white/15 bg-[#222] px-3 py-3 text-white outline-none placeholder:text-white/45";
  return <main className="flex min-h-screen items-center justify-center bg-[#0d0d0d] p-6 text-white"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171717] p-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#ff7a66]">HappiNotes</p><h1 className="mt-2 text-2xl font-bold">{step === "details" ? "Admin access" : challenge ? "Enter admin PIN" : "Verify WhatsApp OTP"}</h1><p className="mt-2 text-sm text-white/60">Admin controls for books, episodes, users and notifications.</p>{step === "details" ? <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Admin WhatsApp number" inputMode="tel" className={`${input} mt-6`} /> : challenge ? <input autoFocus value={pin} onChange={(e) => setPin(digits(e.target.value))} placeholder="6-digit PIN" maxLength={6} type="password" inputMode="numeric" className={`${input} mt-6 py-4 text-center text-2xl tracking-[.35em]`} /> : <><input autoFocus value={otp} onChange={(e) => setOtp(digits(e.target.value))} placeholder="6-digit OTP" maxLength={6} inputMode="numeric" className={`${input} mt-6 py-4 text-center text-2xl tracking-[.5em]`} />{testOtp ? <p className="mt-3 rounded-xl bg-emerald-950 px-3 py-2 text-center text-sm text-emerald-200">Demo OTP: {testOtp}</p> : null}</>}{error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}<button disabled={loading} className="mt-5 w-full rounded-xl bg-[#ff735f] px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Please wait..." : step === "details" ? "Get WhatsApp OTP" : challenge ? "Login" : "Verify OTP"}</button>{step !== "details" ? <button type="button" onClick={() => { setStep("details"); setChallenge(""); setOtp(""); setPin(""); setError(""); }} className="mt-3 w-full text-sm text-white/60">Change number</button> : null}</form></main>;
}
