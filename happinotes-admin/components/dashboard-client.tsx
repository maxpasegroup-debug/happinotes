"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LifebookItem } from "@/lib/content-api";
import { AuthModal } from "@/components/auth-modal";
import { AuthRequired } from "@/components/auth-required";
import { apiRequest } from "@/lib/api";
import { getStoredUser, getUserToken } from "@/lib/user-session";
import { LifebooksPremiumLayout } from "@/components/lifebooks/LifebooksPremiumLayout";
import type { ContinueListeningItem } from "@/components/lifebooks/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";
const FAV_KEY = "web_favourite_ids";
const CONTINUE_KEY = "web_continue_listening";

export function DashboardClient({ initialLifebooks }: { initialLifebooks: LifebookItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [continueItem, setContinueItem] = useState<ContinueListeningItem | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const subscribeOpen = false;
  const setSubscribeOpen = (_value: boolean) => undefined;
  const subError = "";
  const [comingSoonPreview, setComingSoonPreview] = useState<LifebookItem | null>(null);
  const [selected, setSelected] = useState<LifebookItem | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const handleSubscribe = () => undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;
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

    const token = getUserToken();
    if (!token) return;
    apiRequest<{ favourites?: Array<{ _id: string }> }>("/favourites", "GET", undefined, token)
      .then((res) => {
        const ids = (res.favourites || []).map((x) => x._id);
        setFavouriteIds(ids);
        window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
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
      // Keep UX smooth; backend failure should not break layout flow.
    }
  }


  const firstPlayable = useMemo(
    () => initialLifebooks.find((x) => x.status !== "coming_soon") || initialLifebooks[0] || null,
    [initialLifebooks]
  );

  if (!sessionChecked || !authenticated) {
    return <><AuthRequired onLogin={() => { setAuthMode("login"); setAuthOpen(true); }} onCreateAccount={() => { setAuthMode("signup"); setAuthOpen(true); }} /><AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} onSuccess={() => { const user = getStoredUser(); if (user?.role === "admin") { router.replace("/admin/dashboard"); return; } setAuthenticated(true); }} /></>;
  }

  return (
    <>
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
        mobileFirstButtons
      />

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthenticated(true);
          if (selected) {
            const user = getStoredUser();
            rememberContinue(selected, continueItem?.progressPercent || 10);
            router.push(`/player/${selected.id || selected._id}`);
          }
        }}
      />

      {subscribeOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141a2a] p-5">
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
