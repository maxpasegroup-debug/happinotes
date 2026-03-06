"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type UserRow = {
  id?: string;
  _id?: string;
  email: string;
  subscriptionActive?: boolean;
  subscriptionExpiry?: string | null;
  createdAt?: string;
};

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token") || "";
    apiRequest<{ users: UserRow[] }>("/admin/users", "GET", undefined, token)
      .then((res) => setUsers(res.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.subscriptionActive).length;
    return {
      totalUsers: users.length,
      activeSubscribers: active,
      inactiveUsers: users.length - active,
    };
  }, [users]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="Total Users" value={stats.totalUsers} />
        <Metric label="Active Subscribers" value={stats.activeSubscribers} />
        <Metric label="Inactive Users" value={stats.inactiveUsers} />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#11131a]">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#171a24]">
            <tr>
              {["Email", "Premium Status", "Subscription Expiry", "Joined"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs text-[#a1a1aa]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              users.map((u) => (
                <tr key={u.id || u._id || u.email} className="border-t border-white/10">
                  <td className="px-3 py-3 text-white">{u.email}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        u.subscriptionActive
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-white/20 bg-white/5 text-[#d4d4d8]"
                      }`}
                    >
                      {u.subscriptionActive ? "Premium Active" : "Free"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#d4d4d8]">
                    {u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-3 text-[#a1a1aa]">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-[#a1a1aa]" colSpan={4}>
                  No users found.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-3 py-6 text-sm text-[#a1a1aa]" colSpan={4}>
                  Loading subscriptions...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#11131a] p-4">
      <p className="text-xs text-[#a1a1aa]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
