"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifebookItem } from "@/lib/content-api";
import { AuthModal } from "@/components/auth-modal";
import { getStoredUser } from "@/lib/user-session";
import { startRazorpaySubscriptionFlow } from "@/lib/razorpay";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

export function DashboardClient({ initialLifebooks }: { initialLifebooks: LifebookItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [comingSoonPreview, setComingSoonPreview] = useState<LifebookItem | null>(null);
  const [selected, setSelected] = useState<LifebookItem | null>(null);
  const [subError, setSubError] = useState("");

  const filtered = useMemo(() => {
    return search.trim()
      ? initialLifebooks.filter((item) =>
          item.title.toLowerCase().includes(search.toLowerCase())
        )
      : initialLifebooks;
  }, [initialLifebooks, search]);

  async function tryPlay(item: LifebookItem) {
    setSelected(item);
    if (item.status === "coming_soon") {
      setComingSoonPreview(item);
      return;
    }
    const user = getStoredUser();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (item.type === "premium" && !user.subscriptionActive) {
      setSubscribeOpen(true);
      return;
    }
    router.push(`/player/${item.id || item._id}`);
  }

  async function handleSubscribe() {
    setSubError("");
    const user = getStoredUser();
    const token = typeof window !== "undefined" ? window.localStorage.getItem("user_token") : null;
    if (!user || !token) {
      setSubscribeOpen(false);
      setAuthOpen(true);
      return;
    }
    const result = await startRazorpaySubscriptionFlow({
      token,
      email: user.email,
      name: user.name,
    });
    if (!result.ok) {
      setSubError(result.message || "Unable to start payment.");
      return;
    }
    setSubscribeOpen(false);
  }

  function LifebookCard({ item }: { item: LifebookItem }) {
    const premium = item.type === "premium";
    const comingSoon = item.status === "coming_soon";
    const accessLabel = premium ? "PREMIUM" : "FREE";
    const accessClass = premium
      ? "border-amber-300/40 bg-gradient-to-r from-amber-300/20 to-[#f6c453]/25 text-amber-100"
      : "border-emerald-300/40 bg-gradient-to-r from-emerald-300/20 to-emerald-400/25 text-emerald-100";
    return (
      <article
        className="flex h-[238px] w-[168px] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#141a2a] shadow-[0_14px_28px_rgba(0,0,0,0.38)] transition hover:-translate-y-0.5"
      >
        <div className="relative h-[126px] w-full bg-[#0f1422]">
          {comingSoon ? (
            <button
              type="button"
              onClick={() => setComingSoonPreview(item)}
              className="h-full w-full text-left"
            >
              <img
                src={item.thumbnailUrl || FALLBACK_IMAGE}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </button>
          ) : (
            <button type="button" onClick={() => tryPlay(item)} className="h-full w-full text-left">
              <img
                src={item.thumbnailUrl || FALLBACK_IMAGE}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </button>
          )}
          {premium ? (
            <span
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-[13px] font-bold text-[#1f1400] shadow-[0_6px_14px_rgba(246,196,83,0.45)]"
              title="Premium"
            >
              ★
            </span>
          ) : null}
          {comingSoon ? (
            <span className="absolute left-2 top-2 rounded-full border border-white/30 bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
              Coming Soon
            </span>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-between p-3">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold text-white">{item.title}</h3>
            {!comingSoon ? (
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${accessClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${premium ? "bg-amber-200" : "bg-emerald-200"}`} />
                {accessLabel}
              </span>
            ) : null}
          </div>
          {!comingSoon ? (
            <button
              type="button"
              onClick={() => tryPlay(item)}
              className="inline-flex w-fit items-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-3.5 py-1.5 text-xs font-semibold text-[#211100] shadow-[0_8px_16px_rgba(246,196,83,0.28)] transition hover:brightness-105"
            >
              Listen now
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  function EmptyRowCard() {
    return (
      <div className="h-[216px] w-[165px] shrink-0 rounded-3xl border border-dashed border-white/25 bg-[#141a2a] p-4">
        <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-white/10 bg-[#101625]/50 p-3">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm text-white/90">
            ✦
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Lifebooks</p>
            <p className="mt-1 text-xs leading-5 text-[#b7c0d8]">
              No lifebooks yet. New uploads will appear here automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-[#12182a]/70 p-4">
        <div className="mb-3 flex justify-center">
          <img
            src="/happinotes-logo.png"
            alt="Happinotes"
            className="h-28 w-auto object-contain"
          />
        </div>
        <h1 className="text-center text-[38px] font-semibold tracking-tight text-white">
          Lifebooks
        </h1>
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#1a2133] px-4 py-3">
          <div className="flex items-center gap-2 text-[#b7c0d8]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Lifebooks..."
              className="w-full bg-transparent text-base text-white outline-none placeholder:text-[#8f99b3]"
            />
          </div>
        </div>

      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Lifebooks</h2>
          <span className="text-xl text-[#8f99b3]">›</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {filtered.length === 0 ? (
            <EmptyRowCard />
          ) : (
            filtered.map((item) => <LifebookCard key={item._id} item={item} />)
          )}
        </div>
      </section>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          if (selected) {
            const user = getStoredUser();
            if (selected.type === "premium" && !user?.subscriptionActive) {
              setSubscribeOpen(true);
            } else {
              router.push(`/player/${selected.id || selected._id}`);
            }
          }
        }}
      />

      {subscribeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141a2a] p-5">
            <h3 className="text-lg font-semibold text-white">Premium Lifebook</h3>
            <p className="mt-2 text-sm text-[#b7c0d8]">
              Subscribe to unlock premium listening.
            </p>
            {subError ? <p className="mt-2 text-sm text-rose-300">{subError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubscribe}
                className="rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
              >
                Subscribe with Razorpay
              </button>
              <button
                type="button"
                onClick={() => setSubscribeOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {comingSoonPreview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#141a2a]">
            <img
              src={comingSoonPreview.thumbnailUrl || FALLBACK_IMAGE}
              alt={comingSoonPreview.title}
              className="h-auto max-h-[55vh] w-full object-cover"
            />
            <div className="p-5">
              <p className="mb-2 inline-flex rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/90">
                Coming Soon
              </p>
              <h3 className="text-lg font-semibold text-white">{comingSoonPreview.title}</h3>
              <p className="mt-2 text-sm text-[#b7c0d8]">
                {comingSoonPreview.description?.trim() ||
                  "This lifebook is being prepared and will be available shortly."}
              </p>
              <button
                type="button"
                onClick={() => setComingSoonPreview(null)}
                className="mt-4 rounded-full border border-white/20 px-4 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
