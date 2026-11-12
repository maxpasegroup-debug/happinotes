"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { DotLottie } from "@lottiefiles/dotlottie-react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";

const DotLottieAnimation = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((module) => module.DotLottieReact),
  { ssr: false },
);

const motionPreferenceQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotionPreference(onChange: () => void) {
  const preference = window.matchMedia(motionPreferenceQuery);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}
const getAnimationPreference = () => !window.matchMedia(motionPreferenceQuery).matches;
// React uses this same snapshot for SSR and the first hydration render.
const getServerAnimationPreference = () => false;

function SessionCheckAnimation() {
  const animationEnabled = useSyncExternalStore(
    subscribeToMotionPreference,
    getAnimationPreference,
    getServerAnimationPreference,
  );
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const removePlayerListeners = useRef<(() => void) | null>(null);
  const connectPlayer = useCallback((player: DotLottie | null) => {
    removePlayerListeners.current?.();
    removePlayerListeners.current = null;
    if (!player) return;
    setLoaded(player.isLoaded);
    const onLoad = () => setLoaded(true);
    const onError = () => setFailed(true);
    player.addEventListener("load", onLoad);
    player.addEventListener("loadError", onError);
    player.addEventListener("renderError", onError);
    removePlayerListeners.current = () => {
      player.removeEventListener("load", onLoad);
      player.removeEventListener("loadError", onError);
      player.removeEventListener("renderError", onError);
    };
  }, []);
  const showAnimation = animationEnabled && !failed;

  return (
    <div aria-hidden="true" className="relative mx-auto mb-5 flex h-40 w-40 items-center justify-center">
      {(!showAnimation || !loaded) && (
        <div className="flex h-16 w-16 items-center justify-center text-primary">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
          </svg>
        </div>
      )}
      {showAnimation && (
        <DotLottieAnimation
          src="https://lottie.host/7322c369-0e63-47c0-812d-3044591aa428/qjGB2fu9xu.lottie"
          autoplay
          loop
          backgroundColor="transparent"
          dotLottieRefCallback={connectPlayer}
          className={`pointer-events-none absolute inset-0 h-full w-full ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

export default function SecureAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const token = window.localStorage.getItem("admin_token");
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      try {
        const me = await apiRequest<{ user?: { role?: string } }>("/auth/me", "GET", undefined, token);
        if (me?.user?.role !== "admin") {
          window.localStorage.removeItem("admin_token");
          router.replace("/admin/login");
          return;
        }
        if (!cancelled) setAllowed(true);
      } catch {
        window.localStorage.removeItem("admin_token");
        router.replace("/admin/login");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12" aria-busy="true">
      <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
        <SessionCheckAnimation />
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">HappiNotes Studio</p>
        <h1 className="mt-3 !text-2xl font-semibold tracking-tight text-foreground">Preparing your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-default-400">Checking your admin session. Just a moment.</p>
        <div className="mt-7 flex items-center justify-center gap-3 rounded-2xl border border-divider bg-content1/60 px-5 py-4">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-default-400">Verifying access…</span>
        </div>
      </div>
    </main>
  );
  if (!allowed) return null;
  return <AdminShell>{children}</AdminShell>;
}
