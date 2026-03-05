"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, uploadMultipart } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  description: string;
  contentType: "lifebook" | "note" | "silence";
  type: "free" | "premium";
  status: "draft" | "coming_soon" | "live";
  featured?: boolean;
  category?: string;
};

export default function EditContentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Content | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"free" | "premium">("free");
  const [status, setStatus] = useState<"draft" | "coming_soon" | "live">("draft");
  const [featured, setFeatured] = useState(false);
  const [category, setCategory] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token") || "";
    apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token)
      .then((res) => {
        const found = (res.contents || []).find((x) => x._id === params.id) || null;
        setItem(found);
        if (!found) return;
        setTitle(found.title);
        setDescription(found.description || "");
        setType(found.type);
        setStatus(found.status);
        setFeatured(Boolean(found.featured));
        setCategory(found.category || "");
      })
      .catch(() => undefined);
  }, [params.id]);

  async function save() {
    if (!item) return;
    const token = window.localStorage.getItem("admin_token") || "";
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("type", type);
    fd.append("contentType", item.contentType);
    if (item.contentType === "silence") fd.append("category", category);
    fd.append("featured", String(featured));
    if (thumbnail) fd.append("thumbnail", thumbnail);
    if (media) fd.append("media", media);
    try {
      await uploadMultipart(`/admin/contents/${params.id}`, fd, token, undefined, "PUT");
      await apiRequest(`/admin/contents/${params.id}/status`, "PATCH", { status }, token);
      await apiRequest(`/admin/contents/${params.id}/${featured ? "feature" : "unfeature"}`, "PATCH", undefined, token);
      setMessage("Saved");
      router.push("/admin/content");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!item) return <div>Loading content...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ marginTop: 0 }}>Edit Content</h1>
      <div style={{ display: "grid", gap: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value as "free" | "premium")}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "coming_soon" | "live")}>
            <option value="draft">Draft</option>
            <option value="coming_soon">Coming soon</option>
            <option value="live">Live</option>
          </select>
          <label>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
          </label>
        </div>
        {item.contentType === "silence" ? (
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
        ) : null}
        <label>
          Thumbnail
          <input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} />
        </label>
        {item.contentType !== "lifebook" ? (
          <label>
            Media
            <input type="file" accept="audio/*,video/*" onChange={(e) => setMedia(e.target.files?.[0] || null)} />
          </label>
        ) : null}
        <button onClick={save} style={{ padding: 10, background: "#f97316", border: 0, color: "#fff", borderRadius: 8 }}>
          Save
        </button>
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
}
