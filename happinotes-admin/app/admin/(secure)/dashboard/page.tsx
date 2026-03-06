"use client";

import { useEffect, useMemo, useState } from "react";
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

type Step = 1 | 2 | 3 | 4;

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
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

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
    setStep(1);
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
    setStep(1);
    setEditOpen(true);
  }

  async function removeContent(id: string) {
    const ok = window.confirm("Delete this content permanently?");
    if (!ok) return;
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
    const ok = window.confirm(
      status === "live"
        ? "Publish this content to LIVE now?"
        : status === "coming_soon"
          ? "Move this content to COMING SOON?"
          : "Move this content to DRAFT?"
    );
    if (!ok) return;
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
    if (submitting) return;
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
      setSubmitting(true);
      setMessage("Saving...");
      await uploadMultipart("/admin/contents", fd, token, undefined, "POST");
      setMessage("Created successfully");
      setCreateOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!editing) return;
    if (submitting) return;
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
      setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  async function userAction(id: string, action: "block" | "unblock" | "delete") {
    const prompt =
      action === "delete"
        ? "Delete this user account permanently?"
        : action === "block"
          ? "Block this user from access?"
          : "Unblock this user?";
    if (!window.confirm(prompt)) return;
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
  const activeModuleCount =
    activeModule === "lifebooks"
      ? lifebooks.length
      : activeModule === "notes"
        ? notes.length
        : activeModule === "happiness"
          ? happiness.length
          : activeModule === "users"
            ? users.length
            : 0;
  const isLifebookFlow = (createOpen ? createKind : editing?.contentType) === "lifebook";
  const isLiveFlow = form.status === "live";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0f1320] p-5">
        <h1 className="m-0 text-2xl font-semibold text-white">Admin Command Center</h1>
        <p className="mt-2 text-sm text-[#a1a1aa]">
          One clear workflow: choose module, manage items, create/edit through guided popup.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Lifebooks" value={lifebooks.length} />
          <StatCard label="Notes" value={notes.length} />
          <StatCard label="Happiness" value={happiness.length} />
          <StatCard label="Users" value={users.length} />
          <StatCard label="Subscriptions" value={activeSubscriptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[#0f1320] p-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { key: "lifebooks", label: "Lifebooks" },
          { key: "notes", label: "Notes" },
          { key: "happiness", label: "Happiness" },
          { key: "users", label: "Users" },
          { key: "business", label: "Business" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveModule(item.key as ModuleKey)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              activeModule === item.key
                ? "border-[#3b3b48] bg-[#1a1f33] text-white"
                : "border-[#232329] bg-[#101014] text-[#c8cbd3] hover:border-[#343447]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(activeModule === "lifebooks" || activeModule === "notes" || activeModule === "happiness") && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0f1320] p-4">
            <div>
              <h2 className="m-0 text-xl font-semibold text-white">
              {activeModule === "lifebooks" ? "Lifebooks" : activeModule === "notes" ? "Notes" : "Happiness"}
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">{activeModuleCount} items</p>
            </div>
            <button
              onClick={() => openCreate(activeModule === "lifebooks" ? "lifebook" : activeModule === "notes" ? "note" : "silence")}
              className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              Create New
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {activeList.map((item) => (
              <div
                key={item._id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#101014] shadow-[0_8px_20px_rgba(0,0,0,0.3)]"
              >
                <img
                  src={item.thumbnailUrl || "https://via.placeholder.com/600x800?text=Content"}
                  alt={item.title}
                  className="h-[260px] w-full object-cover bg-[#0b0c10]"
                />
                <div className="space-y-3 p-3">
                  <div className="line-clamp-2 text-sm font-semibold text-white">{item.title}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge text={item.status} tone={item.status === "live" ? "green" : item.status === "coming_soon" ? "amber" : "gray"} />
                    <Badge text={item.type} tone={item.type === "premium" ? "purple" : "blue"} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openEdit(item)} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/5">
                      Edit
                    </button>
                    <button
                      onClick={() => removeContent(item._id)}
                      disabled={busyId === item._id}
                      className="rounded-md border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                    {item.status !== "live" ? (
                      <button
                        onClick={() => setStatus(item._id, "live")}
                        disabled={busyId === item._id}
                        className="rounded-md border border-emerald-400/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10"
                      >
                        Publish
                      </button>
                    ) : null}
                    {item.status !== "coming_soon" ? (
                      <button
                        onClick={() => setStatus(item._id, "coming_soon")}
                        disabled={busyId === item._id}
                        className="rounded-md border border-amber-400/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
                      >
                        Coming Soon
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {activeList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 p-6 text-sm text-[#a1a1aa]">
                No items yet. Create your first {activeModule === "happiness" ? "happiness" : activeModule}.
              </div>
            ) : null}
          </div>
        </>
      )}

      {activeModule === "users" && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f1320]">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#101118]">
              <tr>
                {["Email", "Join date", "Subscription", "Blocked", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs text-[#a1a1aa]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const id = u.id || u._id || "";
                return (
                  <tr key={id} className="border-t border-[#1f1f26]">
                    <td className="px-3 py-3 text-white">{u.email}</td>
                    <td className="px-3 py-3 text-[#c8cbd3]">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-3">
                      <Badge text={u.subscriptionActive ? "Active" : "Inactive"} tone={u.subscriptionActive ? "green" : "gray"} />
                    </td>
                    <td className="px-3 py-3">
                      <Badge text={u.blocked ? "Blocked" : "No"} tone={u.blocked ? "rose" : "blue"} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => userAction(id, u.blocked ? "unblock" : "block")}
                          disabled={busyId === id}
                          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/5"
                        >
                        {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          onClick={() => userAction(id, "delete")}
                          disabled={busyId === id}
                          className="rounded-md border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeModule === "business" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#101014] p-4">
            <div className="text-xs text-[#a1a1aa]">Site Visits</div>
            <div className="mt-2 text-3xl font-semibold text-white">N/A</div>
            <div className="mt-1 text-xs text-[#a1a1aa]">Connect analytics integration (GA4/Mixpanel)</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#101014] p-4">
            <div className="text-xs text-[#a1a1aa]">Account Creation</div>
            <div className="mt-2 text-3xl font-semibold text-white">{users.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#101014] p-4">
            <div className="text-xs text-[#a1a1aa]">Subscriptions</div>
            <div className="mt-2 text-3xl font-semibold text-white">{activeSubscriptions}</div>
          </div>
        </div>
      )}

      {(createOpen || editOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-white/10 bg-[#101014] p-5">
            <h3 className="m-0 text-xl font-semibold text-white">
              {createOpen ? `Create ${createKind === "lifebook" ? "Lifebook" : createKind === "note" ? "Note" : "Happiness"}` : "Edit Content"}
            </h3>
            <p className="mt-2 text-sm text-[#a1a1aa]">
              {isLifebookFlow && isLiveFlow
                ? "Guided live flow: Basic -> Intro -> Chapters -> Review"
                : "Simple content flow: fill details and save"}
            </p>

            {isLifebookFlow && isLiveFlow ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStep(n as Step)}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      step === n
                        ? "border-[#f97316] bg-[#2a1a12] text-white"
                        : "border-white/10 bg-[#12131a] text-[#a1a1aa]"
                    }`}
                  >
                    {n === 1 ? "Basic" : n === 2 ? "Intro" : n === 3 ? "Chapters" : "Review"}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {(step === 1 || !isLifebookFlow || !isLiveFlow) && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm text-[#d4d4d8]">
                      Status
                      <select
                        value={form.status}
                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Status }))}
                        className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                      >
                        <option value="coming_soon">Coming Soon</option>
                        <option value="live">Live</option>
                        <option value="draft">Draft</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm text-[#d4d4d8]">
                      Access
                      <select
                        value={form.type}
                        onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as "free" | "premium" }))}
                        className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm text-[#d4d4d8]">
                    Title
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                      className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-[#d4d4d8]">
                    Description
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Description"
                      className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm text-[#d4d4d8]">
                      Language
                      <input
                        value={form.language}
                        onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                        placeholder="Language"
                        className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-sm text-[#d4d4d8]">
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))}
                      />
                      Featured
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm text-[#d4d4d8]">
                    Thumbnail
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.files?.[0] || null }))}
                      className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                    />
                  </label>
                  {(createOpen ? createKind : editing?.contentType) === "silence" ? (
                    <label className="grid gap-1 text-sm text-[#d4d4d8]">
                      Category
                      <input
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Category"
                        className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                      />
                    </label>
                  ) : null}
                </>
              )}

              {isLifebookFlow && isLiveFlow && step === 2 ? (
                <>
                  <label className="grid gap-1 text-sm text-[#d4d4d8]">
                    Intro Title
                    <input
                      value={form.introTitle}
                      onChange={(e) => setForm((prev) => ({ ...prev, introTitle: e.target.value }))}
                      placeholder="Intro title"
                      className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-[#d4d4d8]">
                    Intro Audio/Video
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(e) => setForm((prev) => ({ ...prev, introMedia: e.target.files?.[0] || null }))}
                      className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                    />
                  </label>
                  {form.introMediaUrl ? <p className="text-xs text-[#a1a1aa]">Existing intro media is already attached.</p> : null}
                </>
              ) : null}

              {isLifebookFlow && isLiveFlow && step === 3 ? (
                <>
                  {form.chapters.map((chapter, index) => (
                    <div key={index} className="rounded-xl border border-white/10 bg-[#12131a] p-3">
                      <p className="mb-2 text-xs font-semibold text-[#a1a1aa]">Chapter {index + 1}</p>
                      <div className="grid gap-2">
                        <input
                          value={chapter.title}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)),
                            }))
                          }
                          placeholder={`Chapter ${index + 1} title`}
                          className="rounded-lg border border-white/10 bg-[#0f1016] px-3 py-2 text-white outline-none"
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
                          className="rounded-lg border border-white/10 bg-[#0f1016] px-3 py-2 text-white outline-none"
                        />
                        {chapter.mediaUrl ? <p className="text-xs text-[#a1a1aa]">Existing chapter media attached.</p> : null}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.filter((_, i) => i !== index),
                            }))
                          }
                          className="w-fit rounded-md border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                        >
                          Remove Chapter
                        </button>
                      </div>
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
                    className="w-fit rounded-md border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/5"
                  >
                    + Add Chapter
                  </button>
                </>
              ) : null}

              {isLifebookFlow && isLiveFlow && step === 4 ? (
                <div className="rounded-xl border border-white/10 bg-[#12131a] p-4 text-sm text-[#d4d4d8]">
                  <p><strong>Title:</strong> {form.title || "-"}</p>
                  <p><strong>Status:</strong> {form.status}</p>
                  <p><strong>Type:</strong> {form.type}</p>
                  <p><strong>Intro File:</strong> {form.introMedia ? form.introMedia.name : form.introMediaUrl ? "Using existing intro media" : "Not attached"}</p>
                  <p><strong>Chapters:</strong> {form.chapters.length}</p>
                </div>
              ) : null}

              {(!isLifebookFlow || !isLiveFlow) && (createOpen ? createKind : editing?.contentType) !== "lifebook" && form.status === "live" ? (
                <label className="grid gap-1 text-sm text-[#d4d4d8]">
                  Media (audio/video)
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => setForm((prev) => ({ ...prev, media: e.target.files?.[0] || null }))}
                    className="rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-white outline-none"
                  />
                </label>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => (createOpen ? submitCreate() : submitEdit())}
                  disabled={submitting}
                  className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-70"
                >
                  {submitting ? "Saving..." : createOpen ? "Create" : "Update"}
                </button>
                <button
                  onClick={() => {
                    setCreateOpen(false);
                    setEditOpen(false);
                    setEditing(null);
                    setMessage("");
                    setStep(1);
                  }}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                >
                  Close
                </button>
                {isLifebookFlow && isLiveFlow && step > 1 ? (
                  <button
                    onClick={() => setStep((prev) => (Math.max(1, prev - 1) as Step))}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    Previous
                  </button>
                ) : null}
                {isLifebookFlow && isLiveFlow && step < 4 ? (
                  <button
                    onClick={() => setStep((prev) => (Math.min(4, prev + 1) as Step))}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    Next
                  </button>
                ) : null}
              </div>
              {message ? <div className="text-sm text-rose-300">{message}</div> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: "green" | "amber" | "gray" | "purple" | "blue" | "rose" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        : tone === "purple"
          ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
          : tone === "blue"
            ? "border-blue-400/30 bg-blue-500/10 text-blue-200"
            : tone === "rose"
              ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
              : "border-white/20 bg-white/5 text-[#d4d4d8]";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
      {text}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111520] p-3">
      <p className="text-xs text-[#a1a1aa]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
