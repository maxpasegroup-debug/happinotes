"use client";

import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("admin_token");
    }
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your Happinotes admin panel.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Logout
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-4 py-5">
          <p className="text-sm font-medium text-gray-500">Total Users</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
        </div>
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-4 py-5">
          <p className="text-sm font-medium text-gray-500">Total Content</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
        </div>
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-4 py-5">
          <p className="text-sm font-medium text-gray-500">Premium Content Count</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">0</p>
        </div>
      </section>
    </div>
  );
}

