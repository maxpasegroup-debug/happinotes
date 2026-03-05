"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/user-session";

export function AppHeader() {
  const [hasUser, setHasUser] = useState(false);
  const [initial, setInitial] = useState("U");
  useEffect(() => {
    const user = getStoredUser();
    setHasUser(Boolean(user));
    setInitial((user?.name || user?.email || "U").charAt(0).toUpperCase());
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-white/10 bg-[#0b0f1a]/95 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-md items-center justify-between px-4">
        <button
          type="button"
          className="rounded-lg border border-white/10 p-2 text-[#b7c0d8]"
          aria-label="Menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2 text-base font-semibold text-white">
          <span className="inline-block rounded bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-1.5 py-0.5 text-[10px] font-bold text-[#2d1b00]">
            HB
          </span>
          <span>happinotes</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-white/10 p-2 text-[#b7c0d8]" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {hasUser ? (
            <Link
              href="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-xs font-bold text-[#211100]"
            >
              {initial}
            </Link>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-[#f6c453]"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
