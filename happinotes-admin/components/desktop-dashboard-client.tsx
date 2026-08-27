"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifebookItem } from "@/lib/content-api";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequired } from "@/components/auth-required";
import { apiRequest } from "@/lib/api";
import { getStoredUser, getUserToken } from "@/lib/user-session";
import { startRazorpaySubscriptionFlow } from "@/lib/razorpay";
import { LifebooksPremiumLayout } from "@/components/lifebooks/LifebooksPremiumLayout";
import type { ContinueListeningItem } from "@/components/lifebooks/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";
const FAV_KEY = "web_favourite_ids";
const CONTINUE_KEY = "web_continue_listening";

export function DesktopDashboardClient({ initialLifebooks }: { initialLifebooks: LifebookItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [continueItem, setContinueItem] = useState<ContinueListeningItem | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [comingSoonPreview, setComingSoonPreview] = useState<LifebookItem | null>(null);
  const [selected, setSelected] = useState<LifebookItem | null>(null);
  const [subError, setSubError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAuthenticated(Boolean(window.localStorage.getItem("user_token") || window.localStorage.getItem("admin_token")));
      setSessionChecked(true);
      const rawFav = window.localStorage.getItem(FAV_KEY);
      if (rawFav) {
        try {
          setFavouriteIds(JSON.parse(rawFav) as string[]);
        } catch {
          setFavouriteIds([]);
        }
      }
      const rawContinue = window.localStorage.getItem(CONTINUE_KEY);
      if (rawContinue) {
        try {
          setContinueItem(JSON.parse(rawContinue) as ContinueListeningItem);
        } catch {
          setContinueItem(null);
        }
      }
    }
    const token = getUserToken();
    if (!token) return;
    apiRequest<{ favourites?: Array<{ _id: string }> }>("/favourites", "GET", undefined, token)
      .then((res) => {
        const ids = (res.favourites || []).map((x) => x._id);
        setFavouriteIds(ids);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
        }
      })
      .catch(() => undefined);
  }, []);

  function rememberContinue(item: LifebookItem, progressPercent = 10) {
    const next: ContinueListeningItem = {
      id: item.id || item._id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      progressPercent,
    };
    setContinueItem(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONTINUE_KEY, JSON.stringify(next));
    }
  }

  async function tryPlay(item: LifebookItem, opts?: { allowPreview?: boolean }) {
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
    if (!opts?.allowPreview && item.type === "premium" && !user.subscriptionActive) {
      setSubscribeOpen(true);
      return;
    }
    rememberContinue(item, continueItem?.id === (item.id || item._id) ? continueItem.progressPercent : 10);
    router.push(`/player/${item.id || item._id}`);
  }

  async function toggleFavourite(item: LifebookItem) {
    const token = getUserToken();
    const user = getStoredUser();
    if (!token || !user) {
      setSelected(item);
      setAuthOpen(true);
      return;
    }
    const id = item.id || item._id;
    const exists = favouriteIds.includes(id);
    try {
      if (exists) {
        await apiRequest(`/favourites/${id}`, "DELETE", undefined, token);
      } else {
        await apiRequest(`/favourites/${id}`, "POST", undefined, token);
      }
      setFavouriteIds((prev) => {
        const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
        if (typeof window !== "undefined") {
          window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
        }
        return next;
      });
    } catch {
      // best effort only
    }
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

  const firstPlayable = useMemo(
    () => initialLifebooks.find((x) => x.status !== "coming_soon") || initialLifebooks[0] || null,
    [initialLifebooks]
  );

  if (!sessionChecked || !authenticated) {
    return <><AuthRequired onLogin={() => { setAuthMode("login"); setAuthOpen(true); }} onCreateAccount={() => { setAuthMode("signup"); setAuthOpen(true); }} /><AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} onSuccess={() => { const user = getStoredUser(); if (user?.role === "admin") { router.replace("/admin/dashboard"); return; } setAuthenticated(true); }} /></>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F0F1B] to-[#1A1A2E] text-white">
      <main className="mx-auto max-w-7xl px-6 py-6">
        <LifebooksPremiumLayout
          items={initialLifebooks}
          search={search}
          onSearchChange={setSearch}
          onOpenFavourites={() => router.push("/favourites")}
          onOpenProfile={() => router.push("/profile")}
          onListen={(item) => void tryPlay(item)}
          onPreview={(item) => void tryPlay(item, { allowPreview: true })}
          onToggleFavourite={(item) => void toggleFavourite(item)}
          isFavourite={(id) => favouriteIds.includes(id)}
          continueItem={continueItem}
          onResumeContinue={() => {
            const target = initialLifebooks.find((x) => (x.id || x._id) === continueItem?.id) || firstPlayable;
            if (target) void tryPlay(target, { allowPreview: true });
          }}
        />
      </main>

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthenticated(true);
          if (selected) {
            const user = getStoredUser();
            if (selected.type === "premium" && !user?.subscriptionActive) {
              setSubscribeOpen(true);
            } else {
              rememberContinue(selected, continueItem?.progressPercent || 10);
              router.push(`/player/${selected.id || selected._id}`);
            }
          }
        }}
      />

      {subscribeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141a2a] p-5">
            <h3 className="text-lg font-semibold text-white">Subscription details</h3>
            <p className="mt-2 text-sm text-[#b7c0d8]">
              Unlock all premium lifebooks across web and mobile.
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-[#0f1422] p-3 text-sm text-[#d7deee]">
              <p className="font-semibold text-white">Premium Plan</p>
              <p className="mt-1">₹499 / month</p>
              <p className="mt-1 text-xs text-[#b7c0d8]">Cancel anytime. Secure checkout on next step.</p>
            </div>
            {subError ? <p className="mt-2 text-sm text-rose-300">{subError}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubscribe}
                className="rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-sm font-semibold text-[#211100]"
              >
                Proceed to payment
              </button>
              <button
                type="button"
                onClick={() => setSubscribeOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-white"
              >
                Cancel
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
