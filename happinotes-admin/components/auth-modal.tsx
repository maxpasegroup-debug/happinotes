"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BASE_URL } from "@/lib/content-api";
import {
  createCustomerAccount,
  loginCustomer,
  requestCustomerEmailOtp,
  verifyCustomerEmailOtp,
  type CustomerAuthPurpose,
} from "@/lib/customer-auth";
import { setUserSession } from "@/lib/user-session";

type Mode = CustomerAuthPurpose;
type Step = "details" | "otp";

export function AuthModal({
  open,
  onClose,
  onSuccess,
  initialMode = "login",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setStep("details");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setResendAfterSeconds(0);
    setError("");
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || resendAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendAfterSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, resendAfterSeconds]);

  if (!open) return null;

  const input = "w-full rounded-xl border border-white/15 bg-[#222] px-3 py-3 text-white outline-none placeholder:text-white/45";

  function reset(nextMode: Mode = mode) {
    setMode(nextMode);
    setStep("details");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setResendAfterSeconds(0);
    setError("");
  }

  async function sendOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "signup") {
      if (!name.trim()) return setError("Enter your name.");
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (password !== confirmPassword) return setError("The passwords do not match.");
    }

    setLoading(true);
    setError("");
    try {
      const response = await requestCustomerEmailOtp(BASE_URL, normalizedEmail, mode);
      setResendAfterSeconds(response.resendAfterSeconds);
      setOtp("");
      setStep("otp");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send a code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtpAndAuthenticate() {
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const emailChallenge = await verifyCustomerEmailOtp(BASE_URL, normalizedEmail, mode, otp);
      const session = mode === "signup"
        ? await createCustomerAccount(BASE_URL, { name, email: normalizedEmail, password, emailChallenge })
        : await loginCustomer(BASE_URL, { email: normalizedEmail, password, emailChallenge });
      setUserSession(session.token, session.user);
      onSuccess();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (step === "details") await sendOtp();
    else await verifyOtpAndAuthenticate();
  }

  const heading = step === "otp"
    ? "Check your email"
    : mode === "signup" ? "Create your account" : "Welcome back";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-auth-heading"
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171717] p-5 text-white shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#ff7a66]">HappiNotes</p>
            <h2 id="customer-auth-heading" className="mt-1 text-xl font-bold">{heading}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-white/65" aria-label="Close sign in">
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {step === "details" ? (
            <>
              {mode === "signup" ? (
                <label className="block space-y-1 text-sm text-white/75" htmlFor="customer-name">
                  <span>Your name</span>
                  <input id="customer-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={input} required />
                </label>
              ) : null}
              <label className="block space-y-1 text-sm text-white/75" htmlFor="customer-email">
                <span>Email address</span>
                <input id="customer-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={input} required />
              </label>
              <label className="block space-y-1 text-sm text-white/75" htmlFor="customer-password">
                <span>Password</span>
                <input id="customer-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={input} required minLength={6} />
              </label>
              {mode === "signup" ? (
                <label className="block space-y-1 text-sm text-white/75" htmlFor="customer-confirm-password">
                  <span>Confirm password</span>
                  <input id="customer-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={input} required minLength={6} />
                </label>
              ) : (
                <Link href="/profile" onClick={onClose} className="inline-block text-sm text-[#ff9b8b] underline underline-offset-2">
                  Forgot password? Reset it from your profile.
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-white/70">Enter the 6-digit code sent to <strong className="break-all text-white">{email.trim().toLowerCase()}</strong>.</p>
              <label className="sr-only" htmlFor="customer-email-otp">Email verification code</label>
              <input
                id="customer-email-otp"
                autoFocus
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                maxLength={6}
                inputMode="numeric"
                className={`${input} py-4 text-center text-2xl tracking-[.5em]`}
                required
              />
              <div className="flex items-center justify-between text-sm">
                <button type="button" disabled={loading || resendAfterSeconds > 0} onClick={() => void sendOtp()} className="text-[#ff9b8b] underline underline-offset-2 disabled:text-white/40 disabled:no-underline">
                  {resendAfterSeconds > 0 ? `Resend code in ${resendAfterSeconds}s` : "Resend code"}
                </button>
                <button type="button" disabled={loading} onClick={() => reset(mode)} className="text-white/60 underline underline-offset-2 disabled:opacity-50">
                  Change details
                </button>
              </div>
            </>
          )}

          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-xl bg-[#ff735f] px-4 py-3 font-semibold text-white disabled:opacity-60">
            {loading ? "Please wait..." : step === "details" ? "Email me a code" : mode === "signup" ? "Verify & create account" : "Verify & sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => reset(mode === "signup" ? "login" : "signup")}
          className="mt-4 w-full text-center text-sm text-white/65 hover:text-white"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New to HappiNotes? Create account"}
        </button>
      </section>
    </div>
  );
}
