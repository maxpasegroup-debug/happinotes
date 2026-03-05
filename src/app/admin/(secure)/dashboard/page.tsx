"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  contentType: "lifebook" | "note" | "silence";
  type: "free" | "premium";
  featured?: boolean;
  createdAt?: string;
};

type User = { _id?: string; email: string };

export default function AdminDashboardPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token") || "";
    Promise.all([
      apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token),
      apiRequest<{ users: User[] }>("/admin/users", "GET", undefined, token),
    ])
      .then(([c, u]) => {
        setContents(c.contents || []);
        setUsers(u.users || []);
      })
      .catch(() => undefined);
  }, []);

  const metrics = useMemo(() => {
    return {
      lifebooks: contents.filter((c) => c.contentType === "lifebook").length,
      notes: contents.filter((c) => c.contentType === "note").length,
      happiness: contents.filter((c) => c.contentType === "silence").length,
      users: users.length,
      premium: contents.filter((c) => c.type === "premium").length,
      featured: contents.filter((c) => c.featured).length,
    };
  }, [contents, users]);

  const recent = [...contents]
    .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""))
    .slice(0, 8);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        {[
          ["Total Lifebooks", metrics.lifebooks],
          ["Total Notes", metrics.notes],
          ["Total Happiness", metrics.happiness],
          ["Total Users", metrics.users],
          ["Premium Content", metrics.premium],
          ["Featured Content", metrics.featured],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ border: "1px solid #232329", borderRadius: 12, padding: 14, background: "#101014" }}>
            <div style={{ color: "#a1a1aa", fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Recent uploads</h2>
      <div style={{ border: "1px solid #232329", borderRadius: 12, overflow: "hidden" }}>
        {recent.map((item) => (
          <div
            key={item._id}
            style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderTop: "1px solid #1d1d22" }}
          >
            <div>{item.title}</div>
            <div style={{ color: "#a1a1aa" }}>{item.contentType}</div>
          </div>
        ))}
        {recent.length === 0 ? <div style={{ padding: 12, color: "#a1a1aa" }}>No uploads yet.</div> : null}
      </div>
    </div>
  );
}
