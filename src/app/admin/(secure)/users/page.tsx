"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type User = {
  id?: string;
  _id?: string;
  email: string;
  createdAt?: string;
  subscriptionActive?: boolean;
  blocked?: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const res = await apiRequest<{ users: User[] }>("/admin/users", "GET", undefined, token);
    setUsers(res.users || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function act(id: string, action: "block" | "unblock" | "delete") {
    const token = window.localStorage.getItem("admin_token") || "";
    if (action === "delete") {
      await apiRequest(`/admin/users/${id}`, "DELETE", undefined, token);
    } else {
      await apiRequest(`/admin/users/${id}/${action}`, "PATCH", undefined, token);
    }
    await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Users</h1>
      <div style={{ border: "1px solid #232329", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#101118" }}>
            <tr>
              {["Email", "Join date", "Subscription", "Blocked", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: 10, color: "#a1a1aa", fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const id = u.id || u._id || "";
              return (
                <tr key={id} style={{ borderTop: "1px solid #1f1f26" }}>
                  <td style={{ padding: 10 }}>{u.email}</td>
                  <td style={{ padding: 10 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</td>
                  <td style={{ padding: 10 }}>{u.subscriptionActive ? "Active" : "Inactive"}</td>
                  <td style={{ padding: 10 }}>{u.blocked ? "Blocked" : "No"}</td>
                  <td style={{ padding: 10, display: "flex", gap: 8 }}>
                    <button onClick={() => act(id, u.blocked ? "unblock" : "block")}>
                      {u.blocked ? "Unblock" : "Block"}
                    </button>
                    <button onClick={() => act(id, "delete")}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
