"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Home", href: "/" },
  { label: "Library", href: "/favourites" },
  { label: "Profile", href: "/profile" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function DesktopTopNav() {
  const pathname = usePathname();

  return (
    <header className="hidden border-b border-white/10 bg-[#10172a]/90 backdrop-blur lg:block">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/happinotes-logo.png" alt="Happinotes" className="h-9 w-auto object-contain" />
          <p className="text-sm text-[#b7c0d8]">Practical Books for Real Life</p>
        </div>
        <nav className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141a2a] p-1">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-[#211100]"
                    : "text-[#b7c0d8] hover:bg-white/5 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
