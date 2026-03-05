"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { BASE_URL } from "@/lib/content-api";
import { AuthModal } from "@/components/auth-modal";
import { clearUserSession, getStoredUser, getUserToken, setUserSession } from "@/lib/user-session";
import { startRazorpaySubscriptionFlow } from "@/lib/razorpay";
import type { WebUser } from "@/lib/user-session";

type Me = WebUser;

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setMe(stored as Me);
    const token = getUserToken();
    if (!token) return;
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = (data?.user || null) as Me | null;
        setMe(user);
        if (user) {
          setUserSession(token, user);
        }
      })
      .catch(() => undefined);
  }, []);

  const name = me?.name || "Guest User";
  const sub = me?.subscriptionActive ? "Premium Active" : "Free Plan";
  const initial = name.charAt(0).toUpperCase();

  async function startForgotPassword() {
    setForgotMessage("");
    setForgotLoading(true);
    try {
      const email = forgotEmail.trim().toLowerCase();
      const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setForgotMessage("Unable to send OTP right now.");
        return;
      }
      setForgotStep(2);
      setForgotMessage("OTP sent. Check your email.");
    } catch {
      setForgotMessage("Unable to send OTP right now.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function verifyForgotOtp() {
    setForgotMessage("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: forgotOtp.trim(),
        }),
      });
      if (!res.ok) {
        setForgotMessage("Invalid OTP.");
        return;
      }
      setForgotStep(3);
      setForgotMessage("OTP verified. Set your new password.");
    } catch {
      setForgotMessage("Invalid OTP.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function submitForgotReset() {
    setForgotMessage("");
    setForgotLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      if (!res.ok) {
        setForgotMessage("Could not reset password.");
        return;
      }
      setForgotStep(1);
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotMessage("Password reset successful. Please login.");
    } catch {
      setForgotMessage("Could not reset password.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <MobileShell>
      <section className="rounded-2xl border border-white/10 bg-[#141a2a] p-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-2xl font-bold text-[#1d1200]">
          {initial}
        </div>
        <h1 className="mt-3 text-center text-xl font-semibold text-white">{name}</h1>
        <p className="text-center text-sm text-[#b7c0d8]">{sub}</p>
        {!me ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
            >
              Login / Signup
            </button>
          </div>
        ) : null}
      </section>

      <section className="mt-4 space-y-3">
        <Link href="/favourites" className="block rounded-xl border border-white/10 bg-[#141a2a] px-4 py-3 text-sm text-white">
          Favourites
        </Link>
        <div className="rounded-xl border border-white/10 bg-[#141a2a] px-4 py-3">
          <p className="text-sm font-medium text-white">Billing History</p>
          <p className="mt-1 text-xs text-[#b7c0d8]">
            {me?.subscriptionActive
              ? "Latest payment: Active subscription. Invoice history coming soon."
              : "No billing records yet."}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#141a2a] px-4 py-3">
          <p className="text-sm font-medium text-white">Account Setup</p>
          <p className="mt-1 text-xs text-[#b7c0d8]">
            {me?.email ? `Email: ${me.email}` : "Add your email to get OTP and premium updates."}
          </p>
        </div>
        {!me?.subscriptionActive ? (
          <button
            type="button"
            onClick={async () => {
              const token = getUserToken();
              if (!token) {
                setMessage("Please signup from Lifebooks first.");
                return;
              }
              const result = await startRazorpaySubscriptionFlow({
                token,
                email: me?.email,
                name: me?.name,
              });
              if (result.ok) {
                setMessage("Payment successful.");
              } else {
                setMessage(result.message || "Payment failed.");
              }
            }}
            className="w-full rounded-xl bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-3 text-sm font-semibold text-[#211100]"
          >
            Subscribe with Razorpay
          </button>
        ) : (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Subscription active. Premium lifebooks unlocked.
          </div>
        )}
        {message ? <p className="text-sm text-[#b7c0d8]">{message}</p> : null}

        <div className="rounded-xl border border-white/10 bg-[#141a2a] px-4 py-3">
          <p className="text-sm font-medium text-white">Forgot Password</p>
          <p className="mt-1 text-xs text-[#b7c0d8]">
            Reset access with secure OTP flow.
          </p>
          <div className="mt-3 space-y-2">
            <input
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-lg border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
            />
            {forgotStep >= 2 ? (
              <input
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
                placeholder="6-digit OTP"
                className="w-full rounded-lg border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
              />
            ) : null}
            {forgotStep >= 3 ? (
              <input
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                placeholder="New Password"
                type="password"
                className="w-full rounded-lg border border-white/15 bg-[#0f1422] px-3 py-2 text-sm text-white outline-none"
              />
            ) : null}
            <div className="flex gap-2">
              {forgotStep === 1 ? (
                <button
                  type="button"
                  onClick={startForgotPassword}
                  disabled={forgotLoading || !forgotEmail}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-60"
                >
                  Send OTP
                </button>
              ) : null}
              {forgotStep === 2 ? (
                <button
                  type="button"
                  onClick={verifyForgotOtp}
                  disabled={forgotLoading || !forgotOtp}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-60"
                >
                  Verify OTP
                </button>
              ) : null}
              {forgotStep === 3 ? (
                <button
                  type="button"
                  onClick={submitForgotReset}
                  disabled={forgotLoading || !forgotNewPassword}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-60"
                >
                  Reset Password
                </button>
              ) : null}
              {forgotStep > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep(1);
                    setForgotOtp("");
                    setForgotNewPassword("");
                    setForgotMessage("");
                  }}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#b7c0d8]"
                >
                  Restart
                </button>
              ) : null}
            </div>
            {forgotMessage ? <p className="text-xs text-[#b7c0d8]">{forgotMessage}</p> : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearUserSession();
            setMe(null);
            router.refresh();
          }}
          className="w-full rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
        >
          Logout
        </button>
        <Link href="/" className="block text-center text-sm text-[#f6c453]">
          Back to Lifebooks
        </Link>
      </section>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          const user = getStoredUser();
          if (user) setMe(user as Me);
          setMessage("Logged in successfully.");
        }}
      />
    </MobileShell>
  );
}
