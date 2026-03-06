"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentType: "lifebook" | "note" | "silence";
  type: "free" | "premium";
  status: "draft" | "coming_soon" | "live";
  featured?: boolean;
  createdAt?: string;
};

type User = { _id?: string; email: string };

export default function AdminDashboardPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const [c, u] = await Promise.all([
      apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token),
      apiRequest<{ users: User[] }>("/admin/users", "GET", undefined, token),
    ]);
    setContents(c.contents || []);
    setUsers(u.users || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function setStatus(id: string, status: "draft" | "coming_soon" | "live") {
    const token = window.localStorage.getItem("admin_token") || "";
    setBusyId(id);
    try {
      await apiRequest(`/admin/contents/${id}/status`, "PATCH", { status }, token);
      await load();
    } finally {
      setBusyId(null);
    }
  }

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
  const lifebooks = [...contents]
    .filter((c) => c.contentType === "lifebook")
    .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));

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

      <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Lifebook Playground</h2>
        <Link href="/admin/upload" style={{ background: "#f97316", padding: "10px 12px", borderRadius: 8 }}>
          + Upload New
        </Link>
      </div>
      <p style={{ marginTop: 6, color: "#a1a1aa" }}>
        Click any lifebook card to edit/update. Coming Soon books are included here.
      </p>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {lifebooks.map((book) => (
          <div
            key={book._id}
            style={{
              border: "1px solid #232329",
              borderRadius: 12,
              overflow: "hidden",
              background: "#101014",
            }}
          >
            <Link href={`/admin/content/${book._id}/edit`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <img
                src={book.thumbnailUrl || "https://via.placeholder.com/600x800?text=Lifebook"}
                alt={book.title}
                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", background: "#0b0c10" }}
              />
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{book.title}</div>
                <div style={{ marginTop: 6, color: "#a1a1aa", fontSize: 13 }}>{book.type === "premium" ? "Premium" : "Free"}</div>
                <div style={{ marginTop: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 12,
                      border: "1px solid #2f2f3b",
                      background:
                        book.status === "live"
                          ? "#052e16"
                          : book.status === "coming_soon"
                            ? "#3f2f0b"
                            : "#27272a",
                    }}
                  >
                    {book.status}
                  </span>
                </div>
              </div>
            </Link>
            <div style={{ display: "flex", gap: 8, padding: "0 10px 10px" }}>
              <button
                onClick={() => setStatus(book._id, "live")}
                disabled={book.status === "live" || busyId === book._id}
                style={{ padding: "8px 10px", borderRadius: 8 }}
              >
                Publish Live
              </button>
              <button
                onClick={() => setStatus(book._id, "coming_soon")}
                disabled={book.status === "coming_soon" || busyId === book._id}
                style={{ padding: "8px 10px", borderRadius: 8 }}
              >
                Coming Soon
              </button>
            </div>
          </div>
        ))}
        {lifebooks.length === 0 ? (
          <div style={{ border: "1px dashed #2a2a30", borderRadius: 12, padding: 14, color: "#a1a1aa" }}>
            No lifebooks yet. Upload one and it will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}
