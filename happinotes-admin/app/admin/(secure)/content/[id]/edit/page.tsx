"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest, uploadMultipart } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  contentType: "lifebook" | "note" | "silence";
  type: "free" | "premium";
  status: "draft" | "coming_soon" | "live";
  featured?: boolean;
  category?: string;
  mediaUrl?: string;
};

type LifebookSection = {
  title?: string;
  description?: string;
  mediaUrl?: string;
};

type LifebookLesson = LifebookSection & {
  order?: number;
};

type ContentDetailResponse = {
  content?: Content & {
    intro?: LifebookSection;
    lessons?: LifebookLesson[];
    conclusion?: LifebookSection;
  };
};

type LessonDraft = {
  title: string;
  description: string;
  mediaUrl?: string;
  file: File | null;
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
  const [introTitle, setIntroTitle] = useState("Introduction");
  const [introDescription, setIntroDescription] = useState("");
  const [introMediaUrl, setIntroMediaUrl] = useState("");
  const [introMedia, setIntroMedia] = useState<File | null>(null);
  const [conclusionTitle, setConclusionTitle] = useState("Conclusion");
  const [conclusionDescription, setConclusionDescription] = useState("");
  const [conclusionMediaUrl, setConclusionMediaUrl] = useState("");
  const [conclusionMedia, setConclusionMedia] = useState<File | null>(null);
  const [lessons, setLessons] = useState<LessonDraft[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token") || "";
    Promise.all([
      apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token),
      apiRequest<ContentDetailResponse>(`/contents/${params.id}`, "GET", undefined, token).catch(() => ({ content: undefined })),
    ])
      .then(([res, detailRes]) => {
        const found = (res.contents || []).find((x) => x._id === params.id) || detailRes.content || null;
        setItem(found);
        if (!found) return;
        setTitle(found.title);
        setDescription(found.description || "");
        setType(found.type);
        setStatus(found.status);
        setFeatured(Boolean(found.featured));
        setCategory(found.category || "");

        const detail = detailRes.content;
        if (detail?.intro) {
          setIntroTitle(detail.intro.title || "Introduction");
          setIntroDescription(detail.intro.description || "");
          setIntroMediaUrl(detail.intro.mediaUrl || "");
        }
        if (detail?.conclusion) {
          setConclusionTitle(detail.conclusion.title || "Conclusion");
          setConclusionDescription(detail.conclusion.description || "");
          setConclusionMediaUrl(detail.conclusion.mediaUrl || "");
        }
        const lessonDrafts: LessonDraft[] = (detail?.lessons || []).map((lesson, index) => ({
          title: lesson.title || `Lesson ${index + 1}`,
          description: lesson.description || "",
          mediaUrl: lesson.mediaUrl,
          file: null,
        }));
        setLessons(lessonDrafts.length > 0 ? lessonDrafts : [{ title: "Lesson 1", description: "", mediaUrl: "", file: null }]);
      })
      .catch(() => undefined);
  }, [params.id]);

  async function save() {
    if (!item) return;
    if (saving) return;
    const token = window.localStorage.getItem("admin_token") || "";
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("type", type);
    fd.append("contentType", item.contentType);
    if (item.contentType === "silence") fd.append("category", category);
    fd.append("featured", String(featured));
    if (thumbnail) fd.append("thumbnail", thumbnail);

    if (item.contentType === "lifebook") {
      const introHasData =
        Boolean(introTitle.trim()) ||
        Boolean(introDescription.trim()) ||
        Boolean(introMediaUrl) ||
        Boolean(introMedia);
      if (introHasData) {
        fd.append(
          "intro",
          JSON.stringify({
            title: introTitle.trim() || "Introduction",
            description: introDescription.trim(),
            ...(introMediaUrl ? { mediaUrl: introMediaUrl } : {}),
          })
        );
      }
      if (introMedia) fd.append("introMedia", introMedia);

      const normalizedLessons = lessons
        .map((lesson, index) => ({
          title: lesson.title.trim() || `Lesson ${index + 1}`,
          description: lesson.description.trim(),
          mediaUrl: lesson.mediaUrl || "",
          file: lesson.file,
        }))
        .filter((lesson) => Boolean(lesson.title || lesson.description || lesson.mediaUrl || lesson.file));

      if (normalizedLessons.length > 0) {
        const fileCount = normalizedLessons.filter((x) => Boolean(x.file)).length;
        if (fileCount > 0 && fileCount !== normalizedLessons.length) {
          setMessage("To replace lesson media during edit, select media for every listed lesson.");
          return;
        }
        fd.append(
          "lessons",
          JSON.stringify(
            normalizedLessons.map((lesson, index) => ({
              title: lesson.title,
              description: lesson.description,
              mediaUrl: lesson.mediaUrl || undefined,
              order: index,
            }))
          )
        );
        normalizedLessons.forEach((lesson) => {
          if (lesson.file) fd.append("lessonMedia", lesson.file);
        });
      }

      const conclusionHasData =
        Boolean(conclusionTitle.trim()) ||
        Boolean(conclusionDescription.trim()) ||
        Boolean(conclusionMediaUrl) ||
        Boolean(conclusionMedia);
      if (conclusionHasData) {
        fd.append(
          "conclusion",
          JSON.stringify({
            title: conclusionTitle.trim() || "Conclusion",
            description: conclusionDescription.trim(),
            ...(conclusionMediaUrl ? { mediaUrl: conclusionMediaUrl } : {}),
          })
        );
      }
      if (conclusionMedia) fd.append("conclusionMedia", conclusionMedia);
    } else if (media) {
      fd.append("media", media);
    }

    try {
      setSaving(true);
      await uploadMultipart(`/admin/contents/${params.id}`, fd, token, undefined, "PUT");
      await apiRequest(`/admin/contents/${params.id}/status`, "PATCH", { status }, token);
      await apiRequest(`/admin/contents/${params.id}/${featured ? "feature" : "unfeature"}`, "PATCH", undefined, token);
      setMessage("Saved");
      router.push("/admin/content");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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
        {item.contentType === "lifebook" ? (
          <>
            <h3 style={{ marginBottom: 0 }}>Introduction</h3>
            <input value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} placeholder="Intro title" />
            <input
              value={introDescription}
              onChange={(e) => setIntroDescription(e.target.value)}
              placeholder="Intro description"
            />
            {introMediaUrl ? <div style={{ color: "#a1a1aa", fontSize: 13 }}>Existing intro media detected.</div> : null}
            <input type="file" accept="audio/*,video/*" onChange={(e) => setIntroMedia(e.target.files?.[0] || null)} />

            <h3 style={{ marginBottom: 0 }}>Lessons</h3>
            {lessons.map((lesson, index) => (
              <div key={index} style={{ border: "1px solid #2a2a30", borderRadius: 8, padding: 8 }}>
                <input
                  value={lesson.title}
                  onChange={(e) =>
                    setLessons((prev) => prev.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
                  }
                  placeholder={`Lesson ${index + 1} title`}
                />
                <input
                  value={lesson.description}
                  onChange={(e) =>
                    setLessons((prev) => prev.map((x, i) => (i === index ? { ...x, description: e.target.value } : x)))
                  }
                  placeholder="Lesson description"
                />
                {lesson.mediaUrl ? (
                  <div style={{ color: "#a1a1aa", fontSize: 13, marginTop: 6 }}>Existing lesson media detected.</div>
                ) : null}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) =>
                    setLessons((prev) => prev.map((x, i) => (i === index ? { ...x, file: e.target.files?.[0] || null } : x)))
                  }
                />
                <button
                  type="button"
                  onClick={() => setLessons((prev) => prev.filter((_, i) => i !== index))}
                  style={{ marginTop: 8 }}
                >
                  Remove Lesson
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLessons((prev) => [
                  ...prev,
                  { title: `Lesson ${prev.length + 1}`, description: "", mediaUrl: "", file: null },
                ])
              }
            >
              + Add Lesson
            </button>

            <h3 style={{ marginBottom: 0 }}>Conclusion</h3>
            <input
              value={conclusionTitle}
              onChange={(e) => setConclusionTitle(e.target.value)}
              placeholder="Conclusion title"
            />
            <input
              value={conclusionDescription}
              onChange={(e) => setConclusionDescription(e.target.value)}
              placeholder="Conclusion description"
            />
            {conclusionMediaUrl ? (
              <div style={{ color: "#a1a1aa", fontSize: 13 }}>Existing conclusion media detected.</div>
            ) : null}
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setConclusionMedia(e.target.files?.[0] || null)}
            />
          </>
        ) : (
          <label>
            Media
            <input type="file" accept="audio/*,video/*" onChange={(e) => setMedia(e.target.files?.[0] || null)} />
          </label>
        )}
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: 10, background: "#f97316", border: 0, color: "#fff", borderRadius: 8, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
}
