"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  contentType: "lifebook" | "note" | "silence";
  featured?: boolean;
  thumbnailUrl?: string;
};

export default function FeaturedPage() {
  const [items, setItems] = useState<Content[]>([]);

  async function load() {
    const token = window.localStorage.getItem("admin_token") || "";
    const res = await apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token);
    setItems(res.contents || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function toggle(item: Content) {
    const token = window.localStorage.getItem("admin_token") || "";
    await apiRequest(`/admin/contents/${item._id}/${item.featured ? "unfeature" : "feature"}`, "PATCH", undefined, token);
    await load();
  }

  const featured = useMemo(() => items.filter((x) => x.featured), [items]);
  const unfeatured = useMemo(() => items.filter((x) => !x.featured), [items]);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Featured Content</h1>
      <p style={{ color: "#a1a1aa" }}>Featured items are shown first on the landing sliders.</p>
      <div style={{ marginTop: 16 }}>
        {[["Featured", featured], ["Available", unfeatured]] as const}.map(([label, list]) => (
          <section key={label} style={{ marginBottom: 20 }}>
            <h2>{label}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
              {list.map((item) => (
                <div key={item._id} style={{ border: "1px solid #24242b", borderRadius: 10, overflow: "hidden", background: "#0f1015" }}>
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title} style={{ width: "100%", height: 140, objectFit: "cover" }} /> : null}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ color: "#a1a1aa", fontSize: 12 }}>{item.contentType === "silence" ? "Happiness" : item.contentType}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button onClick={() => toggle(item)}>{item.featured ? "Unfeature" : "Feature"}</button>
                      <Link href={`/admin/content/${item._id}/edit`}>Edit</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
