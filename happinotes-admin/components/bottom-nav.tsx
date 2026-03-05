"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Lifebooks", href: "/" },
  { label: "Favourites", href: "/favourites" },
  { label: "Profile", href: "/profile" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0f1422]/95 backdrop-blur">
      <div className="mx-auto grid h-[70px] w-full max-w-md grid-cols-3">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1"
            >
              <span
                className={`text-sm ${
                  active
                    ? "bg-gradient-to-r from-[#f6c453] to-[#e6a92c] bg-clip-text text-transparent"
                    : "text-[#7d879f]"
                }`}
              >
                {tab.label === "Lifebooks" ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 4.5C5 3.67 5.67 3 6.5 3H18a1 1 0 0 1 1 1v14.5a2.5 2.5 0 0 0-2.5-2.5H6.5A1.5 1.5 0 0 1 5 14.5v-10Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 18.5V20a1 1 0 0 1-1 1H7.5A2.5 2.5 0 0 1 5 18.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.5 7.5h7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : tab.label === "Favourites" ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 20s-6.5-4.35-8.5-7.42C1.1 8.94 3.07 5 6.93 5c1.95 0 3.1 1.07 3.75 2.02C11.33 6.07 12.48 5 14.43 5c3.86 0 5.83 3.94 3.43 7.58C18.5 15.65 12 20 12 20Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 20a8 8 0 0 1 16 0"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  active
                    ? "bg-gradient-to-r from-[#f6c453] to-[#e6a92c] bg-clip-text text-transparent"
                    : "text-[#7d879f]"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
