"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifebookItem } from "@/lib/content-api";
import { AuthModal } from "@/components/auth-modal";
import { getStoredUser } from "@/lib/user-session";
import { startRazorpaySubscriptionFlow } from "@/lib/razorpay";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

export function DesktopDashboardClient({ initialLifebooks }: { initialLifebooks: LifebookItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [comingSoonPreview, setComingSoonPreview] = useState<LifebookItem | null>(null);
  const [selected, setSelected] = useState<LifebookItem | null>(null);
  const [subError, setSubError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAuthed(Boolean(getStoredUser()));
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <header className="border-b border-white/10 bg-[#10172a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <img src="/happinotes-logo.png" alt="Happinotes" className="h-12 w-auto object-contain" />
            <div>
              <p className="text-xl font-semibold">Happinotes Lifebooks</p>
              <p className="text-sm text-[#b7c0d8]">Practical Books for Real Life</p>
            </div>
          </div>
          <div className="flex w-full max-w-3xl items-center justify-end gap-3">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a2133] px-4 py-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lifebooks..."
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-[#8f99b3]"
              />
            </div>
            <button
              type="button"
              onClick={() => router.push("/favourites")}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              Favourites
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
            >
              {isAuthed ? "Profile" : "Login"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Lifebooks</h1>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-[#141a2a] p-10 text-center text-[#b7c0d8]">
              No lifebooks yet. Uploads will appear automatically here.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((item) => {
                const premium = item.type === "premium";
                const comingSoon = item.status === "coming_soon";
                const accessLabel = premium ? "PREMIUM" : "FREE";
                const accessClass = premium
                  ? "border-amber-300/40 bg-gradient-to-r from-amber-300/20 to-[#f6c453]/25 text-amber-100"
                  : "border-emerald-300/40 bg-gradient-to-r from-emerald-300/20 to-emerald-400/25 text-emerald-100";
                return (
                  <article
                    key={item._id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-[#141a2a] shadow-[0_14px_30px_rgba(0,0,0,0.38)] transition hover:-translate-y-0.5"
                  >
                    <div className="relative h-44 w-full">
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
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <button type="button" onClick={() => tryPlay(item)} className="h-full w-full text-left">
                          <img
                            src={item.thumbnailUrl || FALLBACK_IMAGE}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      )}
                      {premium ? (
                        <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-sm font-bold text-[#1f1400]">
                          ★
                        </span>
                      ) : null}
                      {comingSoon ? (
                        <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                          Coming Soon
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 text-base font-semibold">{item.title}</h3>
                      {!comingSoon ? (
                        <>
                          <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${accessClass}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${premium ? "bg-amber-200" : "bg-emerald-200"}`} />
                            {accessLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => tryPlay(item)}
                            className="mt-4 inline-flex items-center rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100] shadow-[0_8px_16px_rgba(246,196,83,0.28)] transition hover:brightness-105"
                          >
                            Listen now
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141a2a] p-5">
            <h3 className="text-lg font-semibold text-white">Premium Lifebook</h3>
            <p className="mt-2 text-sm text-[#b7c0d8]">Subscribe to unlock premium listening.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#141a2a]">
            <img
              src={comingSoonPreview.thumbnailUrl || FALLBACK_IMAGE}
              alt={comingSoonPreview.title}
              className="h-auto max-h-[60vh] w-full object-cover"
            />
            <div className="p-6">
              <p className="mb-2 inline-flex rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/90">
                Coming Soon
              </p>
              <h3 className="text-xl font-semibold text-white">{comingSoonPreview.title}</h3>
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
    </div>
  );
}
