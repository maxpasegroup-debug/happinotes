"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, uploadMultipart } from "@/lib/api";
import { validateCoverFile, validateLessonFile } from "@/lib/media-validation";

type Status = "draft" | "coming_soon" | "live";
type Lesson = { title: string; description: string; mediaUrl: string; mediaType: "audio" | "video"; file: File | null; error: string };
type Content = {
  _id: string; title: string; description?: string; language?: string; thumbnailUrl?: string;
  contentType: "lifebook"; type: "free" | "premium"; status: Status; featured?: boolean;
  lessons?: Array<{ title?: string; description?: string; mediaUrl?: string; mediaType?: "audio" | "video"; order?: number }>;
};

const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-[#0d111b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20";
const cardClass = "rounded-2xl border border-white/10 bg-[#111722] p-5 shadow-xl shadow-black/10 sm:p-6";
const emptyLesson = (index: number): Lesson => ({ title: `Lesson ${index + 1}`, description: "", mediaUrl: "", mediaType: "audio", file: null, error: "" });

function useObjectUrl(file: File | null): string | undefined {
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    const frame = window.requestAnimationFrame(() => setPreview({ file, url: next }));
    return () => {
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(next);
    };
  }, [file]);
  return preview?.file === file ? preview.url : undefined;
}

function cleanFailure(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/internal server error|request failed with status 5\d\d|network error|timed out/i.test(message)) {
    return `${fallback} Your entries are still here. Check your connection and try again. If it keeps happening, contact support.`;
  }
  return message || fallback;
}

function CoverPreview({ file, url, title }: { file: File | null; url?: string; title: string }) {
  const local = useObjectUrl(file);
  const src = local || url;
  return src ? <img src={src} alt={`${title || "Book"} cover preview`} className="h-44 w-32 rounded-xl border border-white/10 object-cover shadow-lg" /> : (
    <div className="flex h-44 w-32 items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 px-3 text-center text-xs text-slate-500">Cover preview</div>
  );
}

function LessonCard({ lesson, index, total, onChange, onRemove, onMove }: {
  lesson: Lesson; index: number; total: number;
  onChange: (value: Partial<Lesson>) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void;
}) {
  const local = useObjectUrl(lesson.file);
  return (
    <article className="rounded-xl border border-white/10 bg-[#0d121b] p-4 sm:p-5" aria-labelledby={`lesson-title-${index}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 id={`lesson-title-${index}`} className="font-semibold text-white">Lesson {index + 1}</h3>
        <div className="flex gap-2">
          <button type="button" aria-label={`Move lesson ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">Move up</button>
          <button type="button" aria-label={`Move lesson ${index + 1} down`} disabled={index === total - 1} onClick={() => onMove(1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">Move down</button>
          <button type="button" onClick={onRemove} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-200 hover:bg-rose-400/10">Remove</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-300">Lesson name
          <input className={inputClass} value={lesson.title} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="For example, A fresh start" />
        </label>
        <label className="text-sm font-medium text-slate-300">Short description
          <input className={inputClass} value={lesson.description} maxLength={500} onChange={(event) => onChange({ description: event.target.value })} placeholder="What will the listener hear?" />
        </label>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor={`lesson-file-${index}`}>MP3 audio</label>
          <input id={`lesson-file-${index}`} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-orange-200`} type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/x-mpeg" onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            const error = await validateLessonFile(file);
            if (error) { onChange({ file, error }); return; }
            onChange({ file, mediaUrl: "", mediaType: "audio", error: "" });
          }} />
          <p className="mt-2 text-xs text-slate-500">MP3 only · up to 50 MB. The book cover is used for this lesson too.</p>
          {lesson.error ? <p className="mt-2 text-sm text-rose-300" role="alert">{lesson.error}</p> : null}
          {lesson.file ? <div className="mt-2 flex flex-wrap items-center gap-2"><p className="truncate text-xs text-slate-300">Selected: {lesson.file.name}</p>{lesson.error ? <button type="button" className="text-xs text-slate-400 underline" onClick={() => onChange({ file: null, error: "" })}>Remove selected file</button> : null}</div> : lesson.mediaUrl ? <p className="mt-2 text-xs text-emerald-300">Audio is saved and ready.</p> : <p className="mt-2 text-xs text-amber-200">No audio selected yet.</p>}
        </div>
        {lesson.error ? null : lesson.mediaType === "video" && lesson.mediaUrl ? <video controls preload="metadata" src={lesson.mediaUrl} className="w-full max-w-sm" aria-label={`Preview lesson ${index + 1} video`} /> : (lesson.file || lesson.mediaUrl) ? <audio controls preload="metadata" src={local || lesson.mediaUrl} className="w-full max-w-sm" aria-label={`Preview lesson ${index + 1} audio`} /> : null}
      </div>
    </article>
  );
}

export default function BookEditor({ contentId }: { contentId?: string }) {
  const router = useRouter();
  const editing = Boolean(contentId);
  const [content, setContent] = useState<Content | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [type, setType] = useState<"free" | "premium">("free");
  const [status, setStatus] = useState<Status>("draft");
  const [featured, setFeatured] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [coverError, setCoverError] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const coverUrl = content?.thumbnailUrl;
  const completeness = useMemo(() => ({
    title: Boolean(title.trim()),
    cover: Boolean(cover || coverUrl),
    lessonCount: lessons.filter((lesson) => lesson.title.trim() && (lesson.mediaUrl || lesson.file)).length,
  }), [title, cover, coverUrl, lessons]);

  useEffect(() => {
    if (!contentId) return;
    const token = window.localStorage.getItem("admin_token") || "";
    apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token)
      .then(({ contents }) => {
        const item = contents?.find((candidate) => candidate._id === contentId);
        if (!item) throw new Error("This book could not be found. Refresh the list and try again.");
        setContent(item);
        setTitle(item.title || ""); setDescription(item.description || ""); setLanguage(item.language || "English");
        setType(item.type || "free"); setStatus(item.status || "draft"); setFeatured(Boolean(item.featured));
        const saved = [...(item.lessons || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLessons(saved.map((lesson, index) => ({ title: lesson.title || `Lesson ${index + 1}`, description: lesson.description || "", mediaUrl: lesson.mediaUrl || "", mediaType: lesson.mediaType || "audio", file: null, error: "" })));
      })
      .catch((error) => setPageError(cleanFailure(error, "Could not load this book.")))
      .finally(() => setLoading(false));
  }, [contentId]);

  function updateLesson(index: number, patch: Partial<Lesson>) {
    setLessons((current) => current.map((lesson, i) => i === index ? { ...lesson, ...patch } : lesson));
    if (patch.title !== undefined || patch.description !== undefined || patch.file !== undefined || patch.error === "") {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[`lesson-${index}`];
        return next;
      });
    }
  }

  function validate(targetStatus: Status): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Enter a book title.";
    if (!language.trim()) errors.language = "Enter a language.";
    if (coverError) errors.cover = coverError;
    if (!editing && !cover) errors.cover = "Choose a cover image.";
    if (targetStatus === "live" && lessons.length === 0) errors.lessons = "Add at least one lesson before publishing.";
    if (lessons.filter((lesson) => lesson.file).length + (cover ? 1 : 0) > 12) errors.lessons = "Upload at most 11 new MP3 files with a new cover in one save. For an existing book, save new lessons in smaller batches.";
    lessons.forEach((lesson, index) => {
      if (!lesson.title.trim()) errors[`lesson-${index}`] = `Lesson ${index + 1}: enter a name.`;
      if (lesson.error) errors[`lesson-${index}`] = lesson.error;
      if (!lesson.file && !lesson.mediaUrl) errors[`lesson-${index}`] = `Lesson ${index + 1}: upload an MP3, or remove this empty lesson card.`;
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save(targetStatus: Status) {
    setPageError(""); setSuccess("");
    if (saving || !validate(targetStatus)) return;
    const token = window.localStorage.getItem("admin_token") || "";
    if (!token) { setPageError("Your admin session has expired. Sign in again, then return to this form."); return; }
    setSaving(true); setSaveProgress(0);
    try {
      const finalLessons = lessons.map((lesson, index) => ({ ...lesson, order: index }));
      const data = new FormData();
      data.append("title", title.trim()); data.append("description", description.trim()); data.append("language", language.trim());
      data.append("contentType", "lifebook"); data.append("type", type); data.append("priceInr", "0");
      data.append("status", editing ? status : targetStatus); data.append("featured", String(featured));
      if (cover) data.append("thumbnail", cover);
      const lessonMediaIndexes: number[] = [];
      finalLessons.forEach((lesson, index) => {
        if (lesson.file) {
          lessonMediaIndexes.push(index);
          data.append("lessonMedia", lesson.file);
        }
      });
      data.append("lessonMediaIndexes", JSON.stringify(lessonMediaIndexes));
      data.append("lessons", JSON.stringify(finalLessons.map(({ title: lessonTitle, description: lessonDescription, mediaUrl, mediaType, order, file }) => ({ title: lessonTitle.trim(), description: lessonDescription.trim(), ...(file ? {} : { mediaUrl }), mediaType: file ? "audio" : mediaType, order }))));

      if (editing && contentId) {
        await uploadMultipart(`/admin/contents/${contentId}`, data, token, setSaveProgress, "PUT");
        if (targetStatus !== status) await apiRequest(`/admin/contents/${contentId}/status`, "PATCH", { status: targetStatus }, token);
        setStatus(targetStatus);
        setSuccess(targetStatus === "live" ? "Book saved and published." : targetStatus === "coming_soon" ? "Book saved as coming soon." : targetStatus === "draft" && status === "live" ? "Book saved and unpublished." : "Book changes saved.");
      } else {
        data.set("status", targetStatus);
        await uploadMultipart("/admin/contents", data, token, setSaveProgress, "POST");
        setSuccess(targetStatus === "live" ? "Book published successfully." : targetStatus === "coming_soon" ? "Book saved as coming soon." : "Draft saved successfully.");
      }
      window.setTimeout(() => router.push("/admin/dashboard"), 800);
    } catch (error) {
      setPageError(cleanFailure(error, "The book could not be saved. Your entries are still here; review the highlighted fields and try again."));
    } finally { setSaving(false); }
  }

  async function chooseCover(file?: File) {
    if (!file) return;
    const error = await validateCoverFile(file);
    if (error) { setCover(file); setCoverError(error); setFieldErrors((current) => ({ ...current, cover: error })); return; }
    setCover(file); setCoverError(""); setFieldErrors((current) => ({ ...current, cover: "" }));
  }

  function moveLesson(index: number, direction: -1 | 1) {
    const next = [...lessons]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setLessons(next);
  }

  if (loading) return <div className="mx-auto max-w-5xl animate-pulse rounded-2xl border border-white/10 bg-[#111722] p-8 text-slate-300">Loading book details…</div>;
  if (editing && !content) return <div className="mx-auto max-w-5xl rounded-2xl border border-rose-300/20 bg-[#111722] p-6 text-rose-200" role="alert">{pageError || "Could not load this book."}</div>;

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10 text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-orange-300">HappiNotes · Library</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{editing ? "Edit book" : "Create a book"}</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Add book details, a cover, and ordered MP3 lessons. Nothing is published until you choose Publish.</p></div>
        <button type="button" onClick={() => router.push("/admin/dashboard")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">Back to books</button>
      </header>

      {pageError ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100" role="alert">{pageError}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100" role="status">{success}</div> : null}

      <section className={cardClass} aria-labelledby="book-details-heading">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="book-details-heading" className="text-lg font-semibold">Book details</h2><p className="mt-1 text-sm text-slate-400">Tell listeners what this book is about.</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{editing ? `Current status: ${status.replace("_", " ")}` : "New book"}</span></div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">Book title
            <input className={inputClass} value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a clear book title" aria-invalid={Boolean(fieldErrors.title)} />
            {fieldErrors.title ? <span className="mt-1 block text-xs text-rose-300">{fieldErrors.title}</span> : null}
          </label>
          <label className="text-sm font-medium text-slate-300">Language
            <input className={inputClass} value={language} maxLength={80} onChange={(event) => setLanguage(event.target.value)} placeholder="English, Malayalam, Hindi…" aria-invalid={Boolean(fieldErrors.language)} />
            {fieldErrors.language ? <span className="mt-1 block text-xs text-rose-300">{fieldErrors.language}</span> : null}
          </label>
          <label className="text-sm font-medium text-slate-300 md:col-span-2">Description
            <textarea className={inputClass} value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="A short description listeners can use to choose this book." />
          </label>
        </div>
        <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><label htmlFor="book-cover" className="block text-sm font-medium text-slate-300">Cover thumbnail</label><input id="book-cover" className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-orange-200`} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void chooseCover(file); }} /><p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP · up to 50 MB. Existing cover stays in place if you leave this empty.</p>{coverError || fieldErrors.cover ? <p className="mt-2 text-sm text-rose-300" role="alert">{coverError || fieldErrors.cover}</p> : null}{cover && coverError ? <button type="button" className="mt-2 text-xs text-slate-400 underline" onClick={() => { setCover(null); setCoverError(""); }}>Remove selected cover</button> : null}</div>
          <CoverPreview file={coverError ? null : cover} url={coverUrl} title={title} />
        </div>
        <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="h-4 w-4 accent-orange-400" />Show this book as featured</label>
      </section>

      <section className={cardClass} aria-labelledby="access-heading">
        <h2 id="access-heading" className="text-lg font-semibold">Access and publishing</h2><p className="mt-1 text-sm text-slate-400">Premium access uses the existing membership system. Publishing makes a complete book visible in the app.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">Access
            <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as "free" | "premium")}><option value="free">Free</option><option value="premium">Premium membership</option></select>
          </label>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Publication status</p><p className="mt-2 font-semibold capitalize text-white">{status.replace("_", " ")}</p><p className="mt-1 text-xs text-slate-400">Drafts are hidden from regular app users. Coming soon shows book details without lesson audio.</p></div>
        </div>
        {status === "live" && completeness.lessonCount === 0 ? <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-100">Add at least one complete lesson before publishing.</p> : null}
      </section>

      <section className={cardClass} aria-labelledby="lessons-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="lessons-heading" className="text-lg font-semibold">Lessons</h2><p className="mt-1 text-sm text-slate-400">Add as many ordered lessons as needed. Listen to each clip before saving.</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{lessons.length} lesson{lessons.length === 1 ? "" : "s"}</span></div>
        {fieldErrors.lessons ? <p className="mb-4 text-sm text-rose-300" role="alert">{fieldErrors.lessons}</p> : null}
        {lessons.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 bg-black/10 px-5 py-8 text-center"><p className="font-medium text-slate-200">No lessons added yet</p><p className="mt-1 text-sm text-slate-500">Add a lesson card, then choose an MP3 file.</p></div> : <div className="space-y-4">{lessons.map((lesson, index) => <div key={index}>{fieldErrors[`lesson-${index}`] ? <p className="mb-2 text-sm text-rose-300" role="alert">{fieldErrors[`lesson-${index}`]}</p> : null}<LessonCard lesson={lesson} index={index} total={lessons.length} onChange={(patch) => updateLesson(index, patch)} onRemove={() => setLessons((current) => current.filter((_, i) => i !== index))} onMove={(direction) => moveLesson(index, direction)} /></div>)}</div>}
        <button type="button" onClick={() => setLessons((current) => [...current, emptyLesson(current.length)])} className="mt-4 rounded-xl border border-dashed border-orange-300/30 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-300/5">+ Add lesson</button>
        <p className="mt-4 text-xs text-slate-500">Lessons use the book cover automatically. This content model does not support separate lesson thumbnails.</p>
      </section>

      <footer className="sticky bottom-3 z-10 rounded-2xl border border-white/10 bg-[#0b0f17]/95 p-3 shadow-2xl backdrop-blur sm:flex sm:items-center sm:justify-between sm:p-4">
        <div className="mb-3 min-h-5 text-xs text-slate-400 sm:mb-0" aria-live="polite">{saving ? `Saving book… ${saveProgress}%` : "Your form stays open if saving or upload needs to be retried."}{saving ? <progress className="ml-3 h-2 w-28 accent-orange-400" max={100} value={saveProgress} /> : null}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => void save(editing ? status : "draft")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">{editing ? "Save changes" : "Save draft"}</button>
          {!editing || status !== "coming_soon" ? <button type="button" disabled={saving} onClick={() => void save("coming_soon")} className="rounded-xl border border-amber-300/25 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-300/10 disabled:opacity-50">Coming soon</button> : null}
          {editing && status === "live" ? <button type="button" disabled={saving} onClick={() => void save("draft")} className="rounded-xl border border-rose-300/25 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-300/10 disabled:opacity-50">Unpublish</button> : null}
          {status !== "live" ? <button type="button" disabled={saving} onClick={() => void save("live")} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-orange-400 disabled:opacity-50">Publish</button> : null}
        </div>
      </footer>
    </main>
  );
}
