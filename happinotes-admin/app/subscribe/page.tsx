"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { startRazorpaySubscriptionFlow } from "@/lib/razorpay";
import { getStoredUser, getUserToken } from "@/lib/user-session";
import { AuthModal } from "@/components/auth-modal";

export default function SubscribePage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "yearly" | null>(null);

  async function subscribe(plan: "monthly" | "yearly") {
    const token = getUserToken();
    const user = getStoredUser();
    if (!token || !user) {
      setMessage("Please login to continue.");
      setAuthOpen(true);
      return;
    }

    setLoadingPlan(plan);
    setMessage("");
    const result = await startRazorpaySubscriptionFlow({
      token,
      email: user.email,
      name: user.name,
      plan,
      onSuccessRedirectUrl: "/subscribe/success",
    });
    if (!result.ok) {
      setMessage(result.message || "Payment failed.");
    }
    setLoadingPlan(null);
  }

  return (
    <MobileShell>
      <section className="rounded-2xl border border-white/10 bg-[#141a2a] p-5">
        <h1 className="text-2xl font-semibold text-white">Choose your plan</h1>
        <p className="mt-2 text-sm text-[#b7c0d8]">
          Subscribe to unlock all premium lifebooks across web and mobile.
        </p>
      </section>

      <section className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#141a2a] p-4">
          <p className="text-sm text-[#b7c0d8]">Monthly</p>
          <p className="mt-1 text-2xl font-semibold text-white">₹499 / month</p>
          <button
            type="button"
            onClick={() => subscribe("monthly")}
            disabled={loadingPlan !== null}
            className="mt-3 rounded-xl bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100] disabled:opacity-70"
          >
            {loadingPlan === "monthly" ? "Opening checkout..." : "Subscribe Monthly"}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#141a2a] p-4">
          <p className="text-sm text-[#b7c0d8]">Yearly</p>
          <p className="mt-1 text-2xl font-semibold text-white">₹4,999 / year</p>
          <button
            type="button"
            onClick={() => subscribe("yearly")}
            disabled={loadingPlan !== null}
            className="mt-3 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {loadingPlan === "yearly" ? "Opening checkout..." : "Subscribe Yearly"}
          </button>
        </div>
      </section>

      {message ? <p className="mt-3 text-sm text-rose-300">{message}</p> : null}
      <Link href="/profile" className="mt-4 inline-block text-sm text-[#f6c453]">
        Back to Profile
      </Link>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setMessage("Login successful. Choose a plan to continue.")}
      />
    </MobileShell>
  );
}
