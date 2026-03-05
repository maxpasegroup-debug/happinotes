"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";

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

  if (checking) return <div style={{ padding: 24 }}>Checking admin access...</div>;
  if (!allowed) return null;
  return <AdminShell>{children}</AdminShell>;
}
