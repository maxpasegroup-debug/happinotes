import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-[#0b0f1a]">
      <main className="px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
