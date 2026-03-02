"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

interface AdminLayoutProps {
  children: ReactNode;
}

interface MeResponse {
  user?: {
    role?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("admin_token")
            : null;

        if (!token) {
          router.replace("/login");
          return;
        }

        const res = await apiRequest<MeResponse>("/auth/me", "GET", undefined, token);
        const user = res.user;

        if (!user || user.role !== "admin") {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("admin_token");
          }
          router.replace("/login");
          return;
        }

        if (!cancelled) {
          setIsAdmin(true);
        }
      } catch {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("admin_token");
        }
        router.replace("/login");
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Checking admin access…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    // While router.replace runs, render nothing to avoid flicker
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 px-4 py-6 hidden md:flex flex-col">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Happinotes Admin</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage content and users.
          </p>
        </div>
        <nav className="space-y-1 text-sm text-gray-700">
          <div className="rounded-md px-3 py-2 bg-gray-100 font-medium">
            Dashboard
          </div>
          <button
            type="button"
            className="w-full text-left rounded-md px-3 py-2 hover:bg-gray-100"
            onClick={() => router.push("/contents")}
          >
            Content
          </button>
          <button
            type="button"
            className="w-full text-left rounded-md px-3 py-2 hover:bg-gray-100"
            onClick={() => router.push("/users")}
          >
            Users
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

