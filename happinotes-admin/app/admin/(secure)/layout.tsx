"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
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
  useEffect(() => () => removePlayerListeners.current?.(), []);
  const showAnimation = animationEnabled && !failed;

  return (
    <div aria-hidden="true" className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
      {(!showAnimation || !loaded) && (
        <div className="flex h-16 w-16 items-center justify-center text-orange-100/80">
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

function SessionCheckingScreen() {
  const animationEnabled = useSyncExternalStore(
    subscribeToMotionPreference,
    getAnimationPreference,
    getServerAnimationPreference,
  );

  return <main className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#100c0d] px-6 py-7 text-orange-50 sm:px-12 sm:py-9" aria-busy="true">
    <div aria-hidden="true" className="pointer-events-none absolute -inset-8 -z-10 overflow-hidden blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_90%,#51231c_0%,#201314_45%,#100c0d_85%)]" />
      <motion.div className="absolute -bottom-1/4 -left-1/4 h-[75vh] w-[90vw] rounded-full bg-orange-500/25 blur-[100px]"
        animate={animationEnabled ? { x: [0, 60, 0], y: [0, -40, 0] } : { x: 0, y: 0 }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute -bottom-1/4 -right-1/4 h-[80vh] w-[80vw] rounded-full bg-red-500/20 blur-[110px]"
        animate={animationEnabled ? { x: [0, -50, 0], scale: [1, 1.1, 1] } : { x: 0, scale: 1 }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200/15 bg-gradient-to-br from-orange-300/15 to-red-400/5">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 4v16M19 4v16M5 12h14M9 17c2 2 4 2 6 0" /></svg>
        </span>
        <span className="text-sm font-semibold tracking-tight">HappiNotes <span className="ml-1 hidden font-normal text-orange-100/40 sm:inline">/ Admin</span></span>
      </div>
      <span className="flex items-center gap-2 text-[11px] text-orange-100/50">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>
        Admin access
      </span>
    </header>
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite" aria-atomic="true">
      <div className="group relative mb-9 flex h-56 w-56 items-center justify-center sm:mb-12 sm:h-64 sm:w-64" aria-hidden="true">
        <div className="absolute inset-7 rounded-full bg-orange-300/5 blur-2xl transition-colors duration-700 group-hover:bg-orange-300/10 motion-reduce:transition-none" />
        <div className="absolute inset-0 rounded-full border border-orange-100/[.07]" />
        <div className="absolute inset-3 rounded-full border border-orange-100/[.04]" />
        <motion.div className="absolute inset-0 rounded-full border border-transparent border-t-orange-100/35 border-r-orange-200/10"
          animate={{ rotate: animationEnabled ? 360 : 0 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}>
          <span className="absolute left-1/2 top-[-3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-orange-100/90 shadow-[0_0_16px_#fed7aa80]" />
        </motion.div>
        <SessionCheckAnimation />
      </div>
      <p className="mb-4 text-[10px] font-medium uppercase tracking-[.3em] text-orange-100/45">Your workspace, coming into focus</p>
      <h1 className="!text-[clamp(2rem,5.5vw,3.75rem)] !font-semibold !leading-[1.12] !tracking-[-.045em]">
        <span className="admin-check-glass-title">Preparing your workspace</span>
      </h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-orange-100/55">Checking your admin session.<br />We’ll open your workspace when it’s ready.</p>
      <div className="mt-8 flex items-center gap-3 rounded-full border border-orange-100/15 bg-gradient-to-r from-orange-300/10 to-red-300/5 px-5 py-3 shadow-[inset_0_1px_0_#ffffff0d,0_8px_32px_#00000012] backdrop-blur-xl">
        <span aria-hidden="true" className="flex items-center gap-1">
          {[0, 1, 2].map(index => <motion.span key={index} className="h-1 w-1 rounded-full bg-orange-200"
            animate={animationEnabled ? { opacity: [.3, 1, .3], y: [0, -2, 0] } : { opacity: .7, y: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: index * .18, ease: 'easeInOut' }} />)}
        </span>
        <span className="text-xs font-medium text-orange-100/75">Verifying access</span>
      </div>
    </div>
    <footer className="text-center text-[11px] tracking-wide text-orange-100/35">HappiNotes Studio</footer>
  </main>;
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

  if (checking) return <SessionCheckingScreen />;
  if (!allowed) return null;
  return <AdminShell>{children}</AdminShell>;
}
