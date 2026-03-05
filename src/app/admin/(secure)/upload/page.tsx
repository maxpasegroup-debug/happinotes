"use client";

import { useMemo, useState } from "react";
import { uploadMultipart } from "@/lib/api";

type Kind = "lifebook" | "note" | "silence";

type LessonDraft = {
  title: string;
  description: string;
  file: File | null;
};

export default function AdminUploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [contentType, setContentType] = useState<Kind>("lifebook");
  const [accessType, setAccessType] = useState<"free" | "premium">("free");
  const [status, setStatus] = useState<"draft" | "coming_soon" | "live">("draft");
  const [featured, setFeatured] = useState(false);
  const [category, setCategory] = useState("");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [introTitle, setIntroTitle] = useState("Introduction");
  const [introDescription, setIntroDescription] = useState("");
  const [introMedia, setIntroMedia] = useState<File | null>(null);
  const [conclusionTitle, setConclusionTitle] = useState("Conclusion");
  const [conclusionDescription, setConclusionDescription] = useState("");
  const [conclusionMedia, setConclusionMedia] = useState<File | null>(null);
  const [lessons, setLessons] = useState<LessonDraft[]>([{ title: "Lesson 1", description: "", file: null }]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [message, setMessage] = useState("");

  const thumbnailPreview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : ""),
    [thumbnail]
  );
  const mediaPreview = useMemo(() => (media ? URL.createObjectURL(media) : ""), [media]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const token = window.localStorage.getItem("admin_token");
    if (!token) return setMessage("Admin token missing");
    if (!thumbnail) return setMessage("Thumbnail is required");
    if (contentType === "lifebook" && (!introMedia || !conclusionMedia || lessons.some((l) => !l.file))) {
      return setMessage("Lifebook requires intro, conclusion, and lesson media files");
    }
    if (contentType !== "lifebook" && !media) return setMessage("Media file is required");

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("language", language);
    fd.append("contentType", contentType);
    fd.append("type", accessType);
    fd.append("status", status);
    fd.append("featured", String(featured));
    fd.append("thumbnail", thumbnail);

    if (contentType === "lifebook") {
      fd.append(
        "intro",
        JSON.stringify({ title: introTitle || "Introduction", description: introDescription })
      );
      fd.append(
        "conclusion",
        JSON.stringify({ title: conclusionTitle || "Conclusion", description: conclusionDescription })
      );
      fd.append(
        "lessons",
        JSON.stringify(
          lessons.map((l, index) => ({
            title: l.title || `Lesson ${index + 1}`,
            description: l.description || "",
            order: index,
          }))
        )
      );
      fd.append("introMedia", introMedia as File);
      fd.append("conclusionMedia", conclusionMedia as File);
      lessons.forEach((l) => fd.append("lessonMedia", l.file as File));
    } else {
      fd.append("media", media as File);
      if (contentType === "silence") fd.append("category", category || "General");
    }

    try {
      setUploadPercent(0);
      await uploadMultipart("/admin/contents", fd, token, setUploadPercent, "POST");
      setMessage("Content uploaded successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Upload Content</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <div style={{ display: "flex", gap: 10 }}>
          <select value={contentType} onChange={(e) => setContentType(e.target.value as Kind)}>
            <option value="lifebook">Lifebook</option>
            <option value="note">Note</option>
            <option value="silence">Happiness</option>
          </select>
          <select value={accessType} onChange={(e) => setAccessType(e.target.value as "free" | "premium")}>
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

        <label>
          Thumbnail
          <input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} />
        </label>
        {thumbnailPreview ? <img src={thumbnailPreview} alt="Thumbnail preview" width={220} /> : null}

        {contentType === "silence" ? (
          <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        ) : null}

        {contentType === "lifebook" ? (
          <>
            <h3>Introduction</h3>
            <input value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} placeholder="Intro title" />
            <input value={introDescription} onChange={(e) => setIntroDescription(e.target.value)} placeholder="Intro description" />
            <input type="file" accept="audio/*,video/*" onChange={(e) => setIntroMedia(e.target.files?.[0] || null)} />
            {introMedia ? <audio controls src={URL.createObjectURL(introMedia)} /> : null}

            <h3>Lessons</h3>
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
                    setLessons((prev) =>
                      prev.map((x, i) => (i === index ? { ...x, description: e.target.value } : x))
                    )
                  }
                  placeholder="Lesson description"
                />
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) =>
                    setLessons((prev) => prev.map((x, i) => (i === index ? { ...x, file: e.target.files?.[0] || null } : x)))
                  }
                />
                {lesson.file ? <audio controls src={URL.createObjectURL(lesson.file)} /> : null}
              </div>
            ))}
            <button type="button" onClick={() => setLessons((prev) => [...prev, { title: `Lesson ${prev.length + 1}`, description: "", file: null }])}>
              + Add Lesson
            </button>

            <h3>Conclusion</h3>
            <input value={conclusionTitle} onChange={(e) => setConclusionTitle(e.target.value)} placeholder="Conclusion title" />
            <input value={conclusionDescription} onChange={(e) => setConclusionDescription(e.target.value)} placeholder="Conclusion description" />
            <input type="file" accept="audio/*,video/*" onChange={(e) => setConclusionMedia(e.target.files?.[0] || null)} />
            {conclusionMedia ? <audio controls src={URL.createObjectURL(conclusionMedia)} /> : null}
          </>
        ) : (
          <>
            <label>
              Media
              <input type="file" accept="audio/*,video/*" onChange={(e) => setMedia(e.target.files?.[0] || null)} />
            </label>
            {mediaPreview && media?.type.startsWith("audio/") ? <audio controls src={mediaPreview} /> : null}
            {mediaPreview && media?.type.startsWith("video/") ? <video controls src={mediaPreview} width={320} /> : null}
          </>
        )}

        <div style={{ color: "#f97316" }}>Upload progress: {uploadPercent}%</div>
        {message ? <div>{message}</div> : null}
        <button type="submit" style={{ padding: 10, background: "#f97316", color: "#fff", border: 0, borderRadius: 8 }}>
          Upload
        </button>
      </form>
    </div>
  );
}
