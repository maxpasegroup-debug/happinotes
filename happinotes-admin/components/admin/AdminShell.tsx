"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const menu = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Content", href: "/admin/content" },
  { label: "Upload", href: "/admin/upload" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "260px 1fr" }}>
      <aside style={{ borderRight: "1px solid #232329", background: "#0b0b0f", padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Happinotes Admin</div>
        <nav style={{ display: "grid", gap: 8 }}>
          {menu.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: active ? "#1a1a22" : "transparent",
                  border: active ? "1px solid #2f2f3b" : "1px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem("admin_token");
              router.replace("/admin/login");
            }}
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #3a2323",
              background: "#1b1111",
              color: "#fca5a5",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </nav>
      </aside>
      <main style={{ padding: 24, background: "#07070a" }}>{children}</main>
    </div>
  );
}
