import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopTopNav } from "@/components/desktop-top-nav";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0F0F1B] to-[#1A1A2E]">
      <DesktopTopNav />
      <div className="mx-auto w-full max-w-md lg:max-w-6xl">
        <main className="px-4 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-6">{children}</main>
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
