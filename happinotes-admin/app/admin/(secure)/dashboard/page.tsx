"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiRequest, uploadMultipart } from "@/lib/api";

type Status = "draft" | "coming_soon" | "live";
type Kind = "lifebook" | "note" | "silence";

type Content = {
  _id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentType: Kind;
  type: "free" | "premium";
  status: Status;
  featured?: boolean;
  createdAt?: string;
};

type User = {
  id?: string;
  _id?: string;
  email: string;
  createdAt?: string;
  subscriptionActive?: boolean;
  blocked?: boolean;
};

type LifebookSection = {
  title?: string;
  description?: string;
  mediaUrl?: string;
};

type LifebookLesson = LifebookSection & { order?: number };

type DetailResponse = {
  content?: Content & {
    intro?: LifebookSection;
    lessons?: LifebookLesson[];
    conclusion?: LifebookSection;
    category?: string;
  };
};

type ModuleKey = "lifebooks" | "notes" | "happiness" | "users" | "business";

type ChapterDraft = {
  title: string;
  file: File | null;
  mediaUrl?: string;
};

type ContentForm = {
  title: string;
  description: string;
  status: Status;
  type: "free" | "premium";
  language: string;
  category: string;
  featured: boolean;
  thumbnail: File | null;
  media: File | null;
  introTitle: string;
  introDescription: string;
  introMedia: File | null;
  introMediaUrl?: string;
  chapters: ChapterDraft[];
};

const moduleButtonStyle: CSSProperties = {
  border: "1px solid #232329",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#101014",
  textAlign: "left",
  cursor: "pointer",
};

function emptyForm(): ContentForm {
  return {
    title: "",
    description: "",
    status: "coming_soon",
    type: "free",
    language: "English",
    category: "General",
    featured: false,
    thumbnail: null,
    media: null,
    introTitle: "Introduction",
    introDescription: "",
    introMedia: null,
    introMediaUrl: "",
    chapters: [{ title: "Chapter 1", file: null, mediaUrl: "" }],
  };
}

export default function AdminDashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("lifebooks");
  const [contents, setContents] = useState<Content[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<Kind>("lifebook");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [form, setForm] = useState<ContentForm>(emptyForm());
  const [message, setMessage] = useState("");

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

  const lifebooks = useMemo(
    () =>
      [...contents]
        .filter((x) => x.contentType === "lifebook")
        .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [contents]
  );
  const notes = useMemo(
    () =>
      [...contents]
        .filter((x) => x.contentType === "note")
        .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [contents]
  );
  const happiness = useMemo(
    () =>
      [...contents]
        .filter((x) => x.contentType === "silence")
        .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [contents]
  );

  function openCreate(kind: Kind) {
    setCreateKind(kind);
    setForm(emptyForm());
    setMessage("");
    setCreateOpen(true);
  }

  async function openEdit(item: Content) {
    setMessage("");
    setEditing(item);
    const next = emptyForm();
    next.title = item.title || "";
    next.description = item.description || "";
    next.status = item.status || "coming_soon";
    next.type = item.type || "free";
    next.featured = Boolean(item.featured);
    if (item.contentType === "silence") next.category = "General";

    const token = window.localStorage.getItem("admin_token") || "";
    const details = await apiRequest<DetailResponse>(`/contents/${item._id}`, "GET", undefined, token).catch(
      () => ({ content: undefined })
    );
    const detail = details.content;
    if (detail?.intro) {
      next.introTitle = detail.intro.title || "Introduction";
      next.introDescription = detail.intro.description || "";
      next.introMediaUrl = detail.intro.mediaUrl || "";
    }
    if (detail?.lessons && detail.lessons.length > 0) {
      next.chapters = detail.lessons.map((lesson, index) => ({
        title: lesson.title || `Chapter ${index + 1}`,
        file: null,
        mediaUrl: lesson.mediaUrl || "",
      }));
    }
    if (detail?.category) next.category = detail.category;
    setForm(next);
    setEditOpen(true);
  }

  async function removeContent(id: string) {
    const token = window.localStorage.getItem("admin_token") || "";
    setBusyId(id);
    try {
      await apiRequest(`/admin/contents/${id}`, "DELETE", undefined, token);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(id: string, status: Status) {
    const token = window.localStorage.getItem("admin_token") || "";
    setBusyId(id);
    try {
      await apiRequest(`/admin/contents/${id}/status`, "PATCH", { status }, token);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function submitCreate() {
    const token = window.localStorage.getItem("admin_token") || "";
    if (!token) return setMessage("Admin token missing");
    if (!form.title.trim()) return setMessage("Title is required");
    if (!form.thumbnail) return setMessage("Thumbnail is required");
    if (form.status === "live" && createKind === "lifebook") {
      if (!form.introMedia) return setMessage("Live lifebook requires intro audio");
      if (!form.chapters[0]?.file) return setMessage("Live lifebook requires Chapter 1 audio");
    }
    if (form.status === "live" && createKind !== "lifebook" && !form.media) {
      return setMessage("Live note/happiness requires media audio");
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("language", form.language || "English");
    fd.append("contentType", createKind);
    fd.append("type", form.type);
    fd.append("status", form.status);
    fd.append("featured", String(form.featured));
    fd.append("thumbnail", form.thumbnail);

    if (createKind === "lifebook") {
      if (form.status === "live") {
        fd.append("intro", JSON.stringify({ title: form.introTitle || "Introduction", description: form.introDescription || "" }));
        if (form.introMedia) fd.append("introMedia", form.introMedia);
        const chapters = form.chapters
          .map((chapter, index) => ({
            title: chapter.title.trim() || `Chapter ${index + 1}`,
            description: "",
            order: index,
            file: chapter.file,
          }))
          .filter((x) => Boolean(x.title || x.file));
        if (chapters.length > 0) {
          fd.append(
            "lessons",
            JSON.stringify(chapters.map(({ title, description, order }) => ({ title, description, order })))
          );
          chapters.forEach((chapter) => {
            if (chapter.file) fd.append("lessonMedia", chapter.file);
          });
        }
      }
    } else {
      if (createKind === "silence") fd.append("category", form.category || "General");
      if (form.media) fd.append("media", form.media);
    }

    try {
      setMessage("Saving...");
      await uploadMultipart("/admin/contents", fd, token, undefined, "POST");
      setMessage("Created successfully");
      setCreateOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function submitEdit() {
    if (!editing) return;
    const token = window.localStorage.getItem("admin_token") || "";
    if (!token) return setMessage("Admin token missing");
    if (!form.title.trim()) return setMessage("Title is required");

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("contentType", editing.contentType);
    fd.append("type", form.type);
    fd.append("featured", String(form.featured));
    if (form.thumbnail) fd.append("thumbnail", form.thumbnail);

    if (editing.contentType === "lifebook" && form.status === "live") {
      if (form.introMedia || form.introMediaUrl || form.introTitle.trim()) {
        fd.append(
          "intro",
          JSON.stringify({
            title: form.introTitle.trim() || "Introduction",
            description: form.introDescription.trim(),
            ...(form.introMediaUrl ? { mediaUrl: form.introMediaUrl } : {}),
          })
        );
        if (form.introMedia) fd.append("introMedia", form.introMedia);
      }
      const chapters = form.chapters
        .map((chapter, index) => ({
          title: chapter.title.trim() || `Chapter ${index + 1}`,
          description: "",
          order: index,
          mediaUrl: chapter.mediaUrl || undefined,
          file: chapter.file,
        }))
        .filter((x) => Boolean(x.title || x.mediaUrl || x.file));
      if (chapters.length > 0) {
        fd.append(
          "lessons",
          JSON.stringify(chapters.map(({ title, description, order, mediaUrl }) => ({ title, description, order, mediaUrl })))
        );
        chapters.forEach((chapter) => {
          if (chapter.file) fd.append("lessonMedia", chapter.file);
        });
      }
    }
    if (editing.contentType !== "lifebook") {
      if (editing.contentType === "silence") fd.append("category", form.category || "General");
      if (form.media) fd.append("media", form.media);
    }

    try {
      setMessage("Saving...");
      await uploadMultipart(`/admin/contents/${editing._id}`, fd, token, undefined, "PUT");
      await apiRequest(`/admin/contents/${editing._id}/status`, "PATCH", { status: form.status }, token);
      await apiRequest(
        `/admin/contents/${editing._id}/${form.featured ? "feature" : "unfeature"}`,
        "PATCH",
        undefined,
        token
      );
      setMessage("Updated successfully");
      setEditOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function userAction(id: string, action: "block" | "unblock" | "delete") {
    const token = window.localStorage.getItem("admin_token") || "";
    setBusyId(id);
    try {
      if (action === "delete") {
        await apiRequest(`/admin/users/${id}`, "DELETE", undefined, token);
      } else {
        await apiRequest(`/admin/users/${id}/${action}`, "PATCH", undefined, token);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const activeList =
    activeModule === "lifebooks"
      ? lifebooks
      : activeModule === "notes"
        ? notes
        : activeModule === "happiness"
          ? happiness
          : [];

  const activeSubscriptions = users.filter((u) => u.subscriptionActive).length;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { key: "lifebooks", label: "1. Lifebooks" },
          { key: "notes", label: "2. Notes" },
          { key: "happiness", label: "3. Happiness" },
          { key: "users", label: "4. Users Management" },
          { key: "business", label: "5. Business" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveModule(item.key as ModuleKey)}
            style={{
              ...moduleButtonStyle,
              background: activeModule === item.key ? "#181820" : "#101014",
              borderColor: activeModule === item.key ? "#3b3b48" : "#232329",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(activeModule === "lifebooks" || activeModule === "notes" || activeModule === "happiness") && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>
              {activeModule === "lifebooks" ? "Lifebooks" : activeModule === "notes" ? "Notes" : "Happiness"}
            </h2>
            <button
              onClick={() => openCreate(activeModule === "lifebooks" ? "lifebook" : activeModule === "notes" ? "note" : "silence")}
              style={{ padding: "10px 12px", borderRadius: 8, background: "#f97316", border: 0, color: "#fff" }}
            >
              Create New {activeModule === "lifebooks" ? "Lifebook" : activeModule === "notes" ? "Note" : "Happiness"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {activeList.map((item) => (
              <div key={item._id} style={{ border: "1px solid #232329", borderRadius: 12, overflow: "hidden", background: "#101014" }}>
                <img
                  src={item.thumbnailUrl || "https://via.placeholder.com/600x800?text=Content"}
                  alt={item.title}
                  style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", background: "#0b0c10" }}
                />
                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#a1a1aa" }}>
                    {item.status} • {item.type}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => openEdit(item)} style={{ padding: "7px 9px", borderRadius: 8 }}>
                      Edit
                    </button>
                    <button onClick={() => removeContent(item._id)} disabled={busyId === item._id} style={{ padding: "7px 9px", borderRadius: 8 }}>
                      Delete
                    </button>
                    {item.status !== "live" ? (
                      <button onClick={() => setStatus(item._id, "live")} disabled={busyId === item._id} style={{ padding: "7px 9px", borderRadius: 8 }}>
                        Publish
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {activeList.length === 0 ? (
              <div style={{ border: "1px dashed #2a2a30", borderRadius: 12, padding: 14, color: "#a1a1aa" }}>No items yet.</div>
            ) : null}
          </div>
        </>
      )}

      {activeModule === "users" && (
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
                      <button onClick={() => userAction(id, u.blocked ? "unblock" : "block")} disabled={busyId === id}>
                        {u.blocked ? "Unblock" : "Block"}
                      </button>
                      <button onClick={() => userAction(id, "delete")} disabled={busyId === id}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeModule === "business" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #232329", borderRadius: 12, padding: 14, background: "#101014" }}>
            <div style={{ color: "#a1a1aa", fontSize: 13 }}>Site Visits</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>N/A</div>
            <div style={{ color: "#a1a1aa", fontSize: 12, marginTop: 4 }}>Add analytics script to track visits</div>
          </div>
          <div style={{ border: "1px solid #232329", borderRadius: 12, padding: 14, background: "#101014" }}>
            <div style={{ color: "#a1a1aa", fontSize: 13 }}>Account Creation</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{users.length}</div>
          </div>
          <div style={{ border: "1px solid #232329", borderRadius: 12, padding: 14, background: "#101014" }}>
            <div style={{ color: "#a1a1aa", fontSize: 13 }}>Subscriptions</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{activeSubscriptions}</div>
          </div>
        </div>
      )}

      {(createOpen || editOpen) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, overflowY: "auto", padding: 16 }}>
          <div style={{ maxWidth: 720, margin: "24px auto", background: "#101014", border: "1px solid #2a2a33", borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {createOpen ? `Create ${createKind === "lifebook" ? "Lifebook" : createKind === "note" ? "Note" : "Happiness"}` : "Edit Content"}
            </h3>
            <div style={{ display: "grid", gap: 10 }}>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Status }))}
              >
                <option value="coming_soon">Coming Soon</option>
                <option value="live">Live</option>
                <option value="draft">Draft</option>
              </select>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" />
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Description"
              />
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as "free" | "premium" }))}
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
                <input
                  value={form.language}
                  onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                  placeholder="Language"
                />
                <label>
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))}
                  />{" "}
                  Featured
                </label>
              </div>
              <label>
                Thumbnail
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.files?.[0] || null }))}
                />
              </label>

              {(createOpen ? createKind : editing?.contentType) === "silence" ? (
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Category"
                />
              ) : null}

              {((createOpen ? createKind : editing?.contentType) === "lifebook" && form.status === "live") ? (
                <>
                  <h4 style={{ marginBottom: 0 }}>Introduction</h4>
                  <input
                    value={form.introTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, introTitle: e.target.value }))}
                    placeholder="Intro title"
                  />
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => setForm((prev) => ({ ...prev, introMedia: e.target.files?.[0] || null }))}
                  />
                  <h4 style={{ marginBottom: 0 }}>Chapters</h4>
                  {form.chapters.map((chapter, index) => (
                    <div key={index} style={{ border: "1px solid #2a2a30", borderRadius: 8, padding: 8 }}>
                      <input
                        value={chapter.title}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            chapters: prev.chapters.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)),
                          }))
                        }
                        placeholder={`Chapter ${index + 1} title`}
                      />
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            chapters: prev.chapters.map((x, i) => (i === index ? { ...x, file: e.target.files?.[0] || null } : x)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            chapters: prev.chapters.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Remove chapter
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        chapters: [...prev.chapters, { title: `Chapter ${prev.chapters.length + 1}`, file: null, mediaUrl: "" }],
                      }))
                    }
                  >
                    + Add Chapter
                  </button>
                </>
              ) : null}

              {((createOpen ? createKind : editing?.contentType) !== "lifebook" && form.status === "live") ? (
                <label>
                  Media (audio/video)
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => setForm((prev) => ({ ...prev, media: e.target.files?.[0] || null }))}
                  />
                </label>
              ) : null}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => (createOpen ? submitCreate() : submitEdit())}
                  style={{ padding: "10px 12px", borderRadius: 8, background: "#f97316", border: 0, color: "#fff" }}
                >
                  {createOpen ? "Create" : "Update"}
                </button>
                <button
                  onClick={() => {
                    setCreateOpen(false);
                    setEditOpen(false);
                    setEditing(null);
                    setMessage("");
                  }}
                  style={{ padding: "10px 12px", borderRadius: 8 }}
                >
                  Close
                </button>
              </div>
              {message ? <div style={{ color: "#fda4af" }}>{message}</div> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
