"use client";

import { FormEvent, useEffect, useState } from "react";
import { BASE_URL } from "@/lib/content-api";
import { setUserSession } from "@/lib/user-session";

type Mode = "signup" | "login";
type Step = "details" | "otp" | "pin";
type ResponseData = { token?: string; user?: { id?: string; name?: string; phoneNumber?: string; role?: "admin" | "user"; subscriptionActive?: boolean; subscriptionExpiry?: string | null }; loginChallenge?: string; testOtp?: string; message?: string };

export function AuthModal({ open, onClose, onSuccess, initialMode = "login" }: { open: boolean; onClose: () => void; onSuccess: () => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");
  const [testOtp, setTestOtp] = useState("");
  const [loginChallenge, setLoginChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setStep("details");
      setError("");
    }
  }, [open, initialMode]);

  if (!open) return null;
  const cleanPhone = () => phone.replace(/\s/g, "");
  function reset(nextMode = mode) { setMode(nextMode); setStep("details"); setName(""); setPhone("+91"); setPin(""); setConfirmPin(""); setOtp(""); setTestOtp(""); setLoginChallenge(""); setError(""); }
  function digits(value: string) { return value.replace(/\D/g, "").slice(0, 6); }

  async function requestOtp() {
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone())) return setError("Enter a valid WhatsApp number with country code.");
    if (mode === "signup" && (!name.trim() || !/^\d{6}$/.test(pin) || pin !== confirmPin)) return setError("Enter your name and matching 6-digit PINs.");
    setLoading(true); setError("");
    try { const res = await fetch(`${BASE_URL}/auth/request-${mode === "signup" ? "signup" : "login"}-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: cleanPhone() }) }); const data = await res.json().catch(() => ({})) as ResponseData; if (!res.ok) return setError(data.message || "Could not send OTP."); setTestOtp(data.testOtp || ""); setStep("otp"); } catch { setError("Unable to reach the backend."); } finally { setLoading(false); }
  }
  async function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit OTP.");
    setLoading(true); setError("");
    try {
      if (mode === "signup") { const res = await fetch(`${BASE_URL}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), phoneNumber: cleanPhone(), pin, otp }) }); const data = await res.json().catch(() => ({})) as ResponseData; if (!res.ok || !data.token || !data.user) return setError(data.message || "Invalid or expired OTP."); setUserSession(data.token, data.user); onSuccess(); onClose(); return; }
      const res = await fetch(`${BASE_URL}/auth/verify-login-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: cleanPhone(), otp }) }); const data = await res.json().catch(() => ({})) as ResponseData; if (!res.ok || !data.loginChallenge) return setError(data.message || "Invalid or expired OTP."); setLoginChallenge(data.loginChallenge); setStep("pin");
    } catch { setError("Unable to verify OTP."); } finally { setLoading(false); }
  }
  async function loginWithPin() {
    if (!/^\d{6}$/.test(pin)) return setError("Enter your 6-digit PIN.");
    setLoading(true); setError("");
    try { const res = await fetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: cleanPhone(), pin, loginChallenge }) }); const data = await res.json().catch(() => ({})) as ResponseData; if (!res.ok || !data.token || !data.user) return setError(data.message || "Invalid WhatsApp number or PIN."); setUserSession(data.token, data.user); onSuccess(); onClose(); } catch { setError("Unable to login."); } finally { setLoading(false); }
  }
  async function submit(e: FormEvent) { e.preventDefault(); if (step === "details") await requestOtp(); else if (step === "otp") await verifyOtp(); else await loginWithPin(); }
  const heading = step === "otp" ? "Verify WhatsApp OTP" : step === "pin" ? "Enter your PIN" : mode === "signup" ? "Create your account" : "Welcome back";
  const input = "w-full rounded-xl border border-white/15 bg-[#222] px-3 py-3 text-white outline-none placeholder:text-white/45";
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#ff7a66]">HappiNotes</p><h3 className="mt-1 text-xl font-bold">{heading}</h3></div><button type="button" onClick={onClose} className="text-sm text-white/60">Close</button></div><form onSubmit={submit} className="space-y-3">{step === "details" && mode === "signup" ? <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} /> : null}{step === "details" ? <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number (+919876543210)" inputMode="tel" className={input} /> : null}{step === "details" && mode === "signup" ? <><input value={pin} onChange={(e) => setPin(digits(e.target.value))} placeholder="Create 6-digit PIN" type="password" inputMode="numeric" className={input} /><input value={confirmPin} onChange={(e) => setConfirmPin(digits(e.target.value))} placeholder="Confirm 6-digit PIN" type="password" inputMode="numeric" className={input} /></> : null}{step === "otp" ? <><p className="text-sm text-white/65">Enter the 6-digit code sent to {phone}.</p>{testOtp ? <p className="rounded-xl bg-emerald-950 px-3 py-2 text-center text-sm text-emerald-200">Demo OTP: {testOtp}</p> : null}<input autoFocus value={otp} onChange={(e) => setOtp(digits(e.target.value))} placeholder="••••••" maxLength={6} inputMode="numeric" className={`${input} py-4 text-center text-2xl tracking-[.5em]`} /></> : null}{step === "pin" ? <input autoFocus value={pin} onChange={(e) => setPin(digits(e.target.value))} placeholder="6-digit PIN" maxLength={6} type="password" inputMode="numeric" className={`${input} py-4 text-center text-2xl tracking-[.35em]`} /> : null}{error ? <p className="text-sm text-rose-300">{error}</p> : null}<button disabled={loading} className="w-full rounded-xl bg-[#ff735f] px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Please wait..." : step === "details" ? "Get WhatsApp OTP" : step === "otp" ? (mode === "signup" ? "Verify & Create Account" : "Verify OTP") : "Login"}</button></form><div className="mt-3 flex items-center justify-between text-sm"><button type="button" onClick={() => reset(mode === "signup" ? "login" : "signup")} className="text-white/65">{mode === "signup" ? "Already have an account? Login" : "New to HappiNotes? Create account"}</button>{step !== "details" ? <button type="button" onClick={() => reset(mode)} className="text-white/65">Change details</button> : null}</div></div></div>;
}
