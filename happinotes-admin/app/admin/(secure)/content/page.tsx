"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  thumbnailUrl?: string;
  contentType: "lifebook" | "note" | "silence";
  type: "free" | "premium";
  status: "draft" | "coming_soon" | "live";
  featured?: boolean;
};

export default function AdminContentPage() {
  const [items, setItems] = useState<Content[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "lifebook" | "note" | "silence">("all");

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const res = await apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token);
    setItems(res.contents || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function act(endpoint: string, method: "PATCH" | "DELETE", body?: unknown) {
    const token = window.localStorage.getItem("admin_token") || "";
    await apiRequest(endpoint, method, body, token);
    await load();
  }

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== "all" && i.contentType !== filter) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>Content</h1>
        <Link href="/admin/upload" style={{ background: "#f97316", padding: "10px 12px", borderRadius: 8 }}>
          + Upload
        </Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #2d2d35", background: "#0f1015", color: "#fff" }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "lifebook" | "note" | "silence")}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #2d2d35", background: "#0f1015", color: "#fff" }}
        >
          <option value="all">All</option>
          <option value="lifebook">Lifebooks</option>
          <option value="note">Notes</option>
          <option value="silence">Happiness</option>
        </select>
      </div>

      <div style={{ border: "1px solid #232329", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#101118" }}>
            <tr>
              {["Thumbnail", "Title", "Type", "Free/Premium", "Status", "Featured", "Actions"].map((h) => (
                <th key={h} style={{ padding: 10, textAlign: "left", fontSize: 12, color: "#a1a1aa" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item._id} style={{ borderTop: "1px solid #1f1f26" }}>
                <td style={{ padding: 10 }}>
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} width={48} height={48} style={{ borderRadius: 8, objectFit: "cover" }} /> : "-"}
                </td>
                <td style={{ padding: 10 }}>{item.title}</td>
                <td style={{ padding: 10 }}>{item.contentType === "silence" ? "Happiness" : item.contentType}</td>
                <td style={{ padding: 10 }}>{item.type}</td>
                <td style={{ padding: 10 }}>{item.status}</td>
                <td style={{ padding: 10 }}>{item.featured ? "Yes" : "No"}</td>
                <td style={{ padding: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/admin/content/${item._id}/edit`}>Edit</Link>
                    <button onClick={() => act(`/admin/contents/${item._id}`, "DELETE")}>Delete</button>
                    <button onClick={() => act(`/admin/contents/${item._id}/${item.featured ? "unfeature" : "feature"}`, "PATCH")}>
                      {item.featured ? "Unfeature" : "Feature"}
                    </button>
                    {item.status !== "live" ? (
                      <button onClick={() => act(`/admin/contents/${item._id}/status`, "PATCH", { status: "live" })}>
                        Publish
                      </button>
                    ) : null}
                    {item.status !== "coming_soon" ? (
                      <button onClick={() => act(`/admin/contents/${item._id}/status`, "PATCH", { status: "coming_soon" })}>
                        Coming Soon
                      </button>
                    ) : null}
                    {item.status !== "draft" ? (
                      <button onClick={() => act(`/admin/contents/${item._id}/status`, "PATCH", { status: "draft" })}>
                        Unpublish
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
