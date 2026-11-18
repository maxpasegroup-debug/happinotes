"use client";

import Image from "next/image";
import LanguagePicker from "@/components/admin/LanguagePicker";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { Card, Switch } from "@heroui/react";

import { AdminButton, AdminCheckbox, AdminInput, AdminTextarea, AdminProgress } from "@/components/admin/ui";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, uploadMultipart } from "@/lib/api";
import { validateCoverFile, validateLessonFile } from "@/lib/media-validation";

type Status = "draft" | "coming_soon" | "live";
type Lesson = { title: string; description: string; mediaUrl: string; mediaType: "audio" | "video"; file: File | null; error: string; accessType: "free" | "premium"; thumbnailUrl: string; thumbnailFile: File | null; thumbnailError: string };
type Content = {
  _id: string; title: string; description?: string; language?: string; thumbnailUrl?: string;
  contentType: "lifebook"; type: "free" | "premium"; priceInr?: number; status: Status; featured?: boolean;
  lessons?: Array<{ title?: string; description?: string; mediaUrl?: string; mediaType?: "audio" | "video"; order?: number; accessType?: "free" | "premium"; thumbnailUrl?: string }>;
};

const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-[#0d111b] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20";
const cardClass = "rounded-2xl border border-divider bg-content1 p-5 sm:p-6";
const emptyLesson = (index: number, accessType: "free" | "premium" = "free"): Lesson => ({ title: `Lesson ${index + 1}`, description: "", mediaUrl: "", mediaType: "audio", file: null, error: "", accessType, thumbnailUrl: "", thumbnailFile: null, thumbnailError: "" });

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

function AccessIcon({ paid, className = "h-5 w-5" }: { paid: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d={paid ? "M8 10V7a4 4 0 0 1 8 0v3" : "M8 10V7a4 4 0 0 1 7.5-2"} />
      <path d="M12 14v3" />
    </svg>
  );
}

function CoverPreview({ file, url, title }: { file: File | null; url?: string; title: string }) {
  const local = useObjectUrl(file);
  const src = local || url;
  return src ? <Image unoptimized width={128} height={176} src={src} alt={`${title || "Book"} cover preview`} className="h-44 w-32 rounded-xl border border-white/10 object-cover shadow-lg" /> : (
    <div className="flex h-44 w-32 items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 px-3 text-center text-xs text-slate-500">Cover preview</div>
  );
}

function LessonCard({ lesson, index, total, bookCoverUrl, onChange, onRemove, onMove }: {
  lesson: Lesson; index: number; total: number; bookCoverUrl?: string;
  onChange: (value: Partial<Lesson>) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void;
}) {
  const confirm = useAdminConfirmation();
  const local = useObjectUrl(lesson.file);
  return (
    <Card as="article" shadow="none" className="rounded-xl border border-divider bg-content1 p-4 sm:p-5" aria-labelledby={`lesson-title-${index}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id={`lesson-title-${index}`} className="font-semibold text-white">Lesson {index + 1}</h3>
        <div className="flex gap-2">
          <AdminButton type="button" aria-label={`Move lesson ${index + 1} up`} disabled={index === 0} onClick={async () => { if (await confirm({ title: 'Move lesson up?', description: `Move “${lesson.title}” one position earlier? Save the book to apply the new order.`, confirmLabel: 'Move up' })) onMove(-1); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">Move up</AdminButton>
          <AdminButton type="button" aria-label={`Move lesson ${index + 1} down`} disabled={index === total - 1} onClick={async () => { if (await confirm({ title: 'Move lesson down?', description: `Move “${lesson.title}” one position later? Save the book to apply the new order.`, confirmLabel: 'Move down' })) onMove(1); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">Move down</AdminButton>
          <AdminButton type="button" onClick={async () => { if (await confirm({ title: 'Remove lesson?', description: `Remove “${lesson.title || `Lesson ${index + 1}`}” from this book? Save the book to apply this change.`, confirmLabel: 'Remove lesson', tone: 'danger' })) onRemove(); }} className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs text-rose-200 hover:bg-rose-400/10">Remove</AdminButton>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-300">Lesson name
          <AdminInput className={inputClass} value={lesson.title} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="For example, A fresh start" />
        </label>
        <label className="text-sm font-medium text-slate-300">Short description
          <AdminInput className={inputClass} value={lesson.description} maxLength={500} onChange={(event) => onChange({ description: event.target.value })} placeholder="What will the listener hear?" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-content2/40 p-4">
        <div><p className="text-sm font-semibold text-foreground">Lesson access</p><p className="mt-1 text-xs text-default-500">{lesson.accessType === 'premium' ? 'Paid · unlocked by Pro or an existing book purchase.' : 'Free · everyone can listen to this lesson.'}</p></div>
        <Switch size="sm" color="warning" isSelected={lesson.accessType === 'premium'} onValueChange={(paid) => onChange({ accessType: paid ? 'premium' : 'free' })} aria-label={`Paid access for lesson ${index + 1}`}>
          <span className="text-sm font-semibold">{lesson.accessType === 'premium' ? 'Paid' : 'Free'}</span>
        </Switch>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <label className="text-sm font-medium text-slate-300" htmlFor={`lesson-thumbnail-${index}`}>Lesson thumbnail</label>
          <AdminInput id={`lesson-thumbnail-${index}`} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className={inputClass} onChange={async (event) => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
            if (!file) return;
            const error = await validateCoverFile(file);
            if (error) { onChange({ thumbnailError: error }); return; }
            if (!await confirm({ title: 'Update lesson thumbnail?', description: `Use “${file.name}” for this lesson? It will upload when you save the book.`, confirmLabel: 'Use image' })) return;
            onChange({ thumbnailFile: file, thumbnailError: '' });
          }} />
          <p className="mt-2 text-xs text-slate-500">JPG, PNG or WebP · up to 50 MB. Without a custom image, this lesson uses the book cover.</p>
          {lesson.thumbnailError ? <p className="mt-2 text-sm text-rose-300" role="alert">{lesson.thumbnailError}</p> : null}
          {lesson.thumbnailFile || lesson.thumbnailUrl ? <AdminButton type="button" className="mt-2 text-xs" onClick={async () => {
            if (await confirm({ title: 'Use book cover?', description: 'Remove this lesson’s custom thumbnail when you save the book?', confirmLabel: 'Use book cover' })) onChange({ thumbnailFile: null, thumbnailUrl: '', thumbnailError: '' });
          }}>Use book cover</AdminButton> : null}
        </div>
        <CoverPreview file={lesson.thumbnailFile} url={lesson.thumbnailUrl || bookCoverUrl} title={lesson.title} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <label className="block text-sm font-medium text-slate-300" htmlFor={`lesson-file-${index}`}>MP3 audio</label>
          <AdminInput id={`lesson-file-${index}`} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-orange-200`} type="file" accept=".mp3,audio/mpeg,audio/mp3,audio/x-mpeg" onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            const error = await validateLessonFile(file);
            if (error) { onChange({ file, error }); return; }
            if (!await confirm({ title: lesson.file || lesson.mediaUrl ? 'Replace lesson audio?' : 'Add lesson audio?', description: `Use “${file.name}” for this lesson? It will be uploaded when you save the book.`, confirmLabel: lesson.file || lesson.mediaUrl ? 'Replace audio' : 'Add audio' })) return;
            onChange({ file, mediaUrl: "", mediaType: "audio", error: "" });
          }} />
          <p className="mt-2 text-xs text-slate-500">MP3 only · up to 50 MB.</p>
          {lesson.error ? <p className="mt-2 text-sm text-rose-300" role="alert">{lesson.error}</p> : null}
          {lesson.file ? <div className="mt-2 flex flex-wrap items-center gap-2"><p className="truncate text-xs text-slate-300">Selected: {lesson.file.name}</p>{lesson.error ? <AdminButton type="button" className="text-xs text-slate-400 underline" onClick={async () => { if (await confirm({ title: 'Remove selected file?', description: 'Remove this selected audio file from the form?', confirmLabel: 'Remove file', tone: 'danger' })) onChange({ file: null, error: '' }); }}>Remove selected file</AdminButton> : null}</div> : lesson.mediaUrl ? <p className="mt-2 text-xs text-emerald-300">Audio is saved and ready.</p> : <p className="mt-2 text-xs text-amber-200">No audio selected yet.</p>}
        </div>
        {lesson.error ? null : lesson.mediaType === "video" && lesson.mediaUrl ? <video controls preload="metadata" src={lesson.mediaUrl} className="w-full max-w-sm" aria-label={`Preview lesson ${index + 1} video`} /> : (lesson.file || lesson.mediaUrl) ? <audio controls preload="metadata" src={local || lesson.mediaUrl} className="w-full max-w-sm" aria-label={`Preview lesson ${index + 1} audio`} /> : null}
      </div>
    </Card>
  );
}

export default function BookEditor({ contentId }: { contentId?: string }) {
  const confirm = useAdminConfirmation();
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
  const selectedCoverUrl = useObjectUrl(coverError ? null : cover);
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
        setType(item.type === "premium" || Number(item.priceInr) > 0 ? "premium" : "free"); setStatus(item.status || "draft"); setFeatured(Boolean(item.featured));
        const saved = [...(item.lessons || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLessons(saved.map((lesson, index) => ({ title: lesson.title || `Lesson ${index + 1}`, description: lesson.description || "", mediaUrl: lesson.mediaUrl || "", mediaType: lesson.mediaType || "audio", file: null, error: "", accessType: lesson.accessType || (item.type === "premium" || Number(item.priceInr) > 0 ? "premium" : "free"), thumbnailUrl: lesson.thumbnailUrl || "", thumbnailFile: null, thumbnailError: "" })));
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
    if (lessons.reduce((count, lesson) => count + Number(Boolean(lesson.file)) + Number(Boolean(lesson.thumbnailFile)), 0) + (cover ? 1 : 0) > 12) errors.lessons = "Upload at most 12 files in one save, including audio and thumbnails. Save larger books in batches.";
    lessons.forEach((lesson, index) => {
      if (!lesson.title.trim()) errors[`lesson-${index}`] = `Lesson ${index + 1}: enter a name.`;
      if (lesson.thumbnailError) errors[`lesson-${index}`] = lesson.thumbnailError;
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
    const keepingStatus = editing && targetStatus === status;
    if (!await confirm({
      title: keepingStatus ? 'Save book changes?' : targetStatus === 'live' ? 'Save and publish book?' : targetStatus === 'coming_soon' ? 'Mark book as coming soon?' : editing && status === 'live' ? 'Unpublish book?' : 'Save book draft?',
      description: `Save “${title}” and upload any selected files? ${targetStatus === 'live' ? 'The book will be available using its existing access rules.' : targetStatus === 'coming_soon' ? 'Listeners will see the book as coming soon, without lesson audio.' : 'The book will be hidden from listeners as a draft.'}`,
      confirmLabel: keepingStatus ? 'Save changes' : targetStatus === 'live' ? 'Save & publish' : targetStatus === 'coming_soon' ? 'Coming soon' : editing && status === 'live' ? 'Unpublish' : 'Save draft',
      tone: targetStatus === 'coming_soon' || (targetStatus === 'draft' && status === 'live') ? 'warning' : 'primary',
    })) return;
    setSaving(true); setSaveProgress(0);
    try {
      const finalLessons = lessons.map((lesson, index) => ({ ...lesson, order: index }));
      const data = new FormData();
      data.append("title", title.trim()); data.append("description", description.trim()); data.append("language", language.trim());
      data.append("contentType", "lifebook"); data.append("type", Number(content?.priceInr) > 0 ? "free" : lessons.length ? (lessons.some((lesson) => lesson.accessType === "premium") ? "premium" : "free") : type); data.append("priceInr", String(content?.priceInr ?? 0));
      data.append("status", editing ? status : targetStatus); data.append("featured", String(featured));
      if (cover) data.append("thumbnail", cover);
      const lessonMediaIndexes: number[] = [];
      const lessonThumbnailIndexes: number[] = [];
      finalLessons.forEach((lesson, index) => {
        if (lesson.thumbnailFile) { lessonThumbnailIndexes.push(index); data.append("lessonThumbnail", lesson.thumbnailFile); }
        if (lesson.file) {
          lessonMediaIndexes.push(index);
          data.append("lessonMedia", lesson.file);
        }
      });
      data.append("lessonMediaIndexes", JSON.stringify(lessonMediaIndexes));
      data.append("lessonThumbnailIndexes", JSON.stringify(lessonThumbnailIndexes));
      data.append("lessons", JSON.stringify(finalLessons.map(({ title: lessonTitle, description: lessonDescription, mediaUrl, mediaType, order, file, accessType, thumbnailUrl }) => ({ accessType, thumbnailUrl, title: lessonTitle.trim(), description: lessonDescription.trim(), ...(file ? {} : { mediaUrl }), mediaType: file ? "audio" : mediaType, order }))));

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
      window.setTimeout(() => router.push("/admin/story-books"), 800);
    } catch (error) {
      setPageError(cleanFailure(error, "The book could not be saved. Your entries are still here; review the highlighted fields and try again."));
    } finally { setSaving(false); }
  }

  async function chooseCover(file?: File) {
    if (!file) return;
    const error = await validateCoverFile(file);
    if (error) { setCover(file); setCoverError(error); setFieldErrors((current) => ({ ...current, cover: error })); return; }
    if (!await confirm({ title: cover || coverUrl ? 'Replace book cover?' : 'Add book cover?', description: `Use “${file.name}” as the cover? It will be uploaded when you save the book.`, confirmLabel: cover || coverUrl ? 'Replace cover' : 'Add cover' })) return;
    setCover(file); setCoverError(""); setFieldErrors((current) => ({ ...current, cover: "" }));
  }

  function moveLesson(index: number, direction: -1 | 1) {
    const next = [...lessons]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setLessons(next);
  }

  if (loading) return <Card as="div" shadow="none" className="w-full min-w-0 animate-pulse rounded-2xl border border-divider bg-content1 p-8 text-slate-300">Loading book details…</Card>;
  if (editing && !content) return <Card as="div" shadow="none" className="w-full min-w-0 rounded-2xl border border-rose-300/20 bg-content1 p-6 text-rose-200" role="alert">{pageError || "Could not load this book."}</Card>;

  return (
    <main className="w-full min-w-0 space-y-5 pb-10 text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-orange-300">HappiNotes · Library</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{editing ? "Edit book" : "Create a book"}</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Add book details, a cover, and ordered MP3 lessons. Nothing is published until you choose Publish.</p></div>
        <AdminButton type="button" onClick={async () => { if (await confirm({ title: 'Leave book editor?', description: 'Return to the book library? Any unsaved changes will be lost.', confirmLabel: 'Leave editor', tone: 'warning' })) router.push('/admin/story-books'); }} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">Back to books</AdminButton>
      </header>

      {pageError ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100" role="alert">{pageError}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100" role="status">{success}</div> : null}

      <Card as="section" shadow="none" className={cardClass} aria-labelledby="book-details-heading">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="book-details-heading" className="text-lg font-semibold">Book details</h2><p className="mt-1 text-sm text-slate-400">Tell listeners what this book is about.</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{editing ? `Current status: ${status.replace("_", " ")}` : "New book"}</span></div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">Book title
            <AdminInput className={inputClass} value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a clear book title" aria-invalid={Boolean(fieldErrors.title)} />
            {fieldErrors.title ? <span className="mt-1 block text-xs text-rose-300">{fieldErrors.title}</span> : null}
          </label>
          <LanguagePicker value={language} onChange={setLanguage} error={fieldErrors.language} disabled={saving} />
          <label className="text-sm font-medium text-slate-300 md:col-span-2">Description
            <AdminTextarea className={inputClass} value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="A short description listeners can use to choose this book." />
          </label>
        </div>
        <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><label htmlFor="book-cover" className="block text-sm font-medium text-slate-300">Cover thumbnail</label><AdminInput id="book-cover" className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-orange-200`} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void chooseCover(file); }} /><p className="mt-2 text-xs text-slate-500">JPG, PNG, or WebP · up to 50 MB. Existing cover stays in place if you leave this empty.</p>{coverError || fieldErrors.cover ? <p className="mt-2 text-sm text-rose-300" role="alert">{coverError || fieldErrors.cover}</p> : null}{cover && coverError ? <AdminButton type="button" className="mt-2 text-xs text-slate-400 underline" onClick={async () => { if (await confirm({ title: 'Remove selected cover?', description: 'Remove this selected cover image from the form?', confirmLabel: 'Remove cover', tone: 'danger' })) { setCover(null); setCoverError(''); } }}>Remove selected cover</AdminButton> : null}</div>
          <CoverPreview file={coverError ? null : cover} url={coverUrl} title={title} />
        </div>
        <AdminCheckbox isSelected={featured} onValueChange={setFeatured} className="mt-5 rounded-xl border border-white/10 px-4 py-3">Show this book as featured</AdminCheckbox>
      </Card>

      <Card as="section" shadow="none" className={cardClass} aria-labelledby="access-heading">
        <h2 id="access-heading" className="text-lg font-semibold">Access and publishing</h2><p className="mt-1 text-sm text-slate-400">Set Free or Paid on each lesson below. Paid lessons use the existing Pro membership and book purchase access.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className={`rounded-xl border p-4 transition-colors duration-300 motion-reduce:transition-none ${type === 'premium' ? 'border-orange-400/30 bg-orange-500/5' : 'border-emerald-400/20 bg-emerald-500/5'}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Default for new lessons</p>
            <div className="mt-3 flex items-center gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 motion-reduce:transition-none ${type === 'premium' ? 'bg-orange-500/15 text-orange-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                <AccessIcon paid={type === 'premium'} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{type === 'premium' ? 'Paid · Pro access' : 'Free access'}</p>
                <p className="mt-0.5 text-xs text-slate-400">{type === 'premium' ? 'New lessons require paid access.' : 'New lessons are free to listen to.'}</p>
              </div>
              <Switch
                size="lg"
                color="warning"
                isSelected={type === 'premium'}
                isDisabled={saving}
                onValueChange={(paid) => setType(paid ? 'premium' : 'free')}
                aria-label="Paid access by default for new lessons"
                aria-describedby="lesson-access-default-help"
                thumbIcon={<AccessIcon paid={type === 'premium'} className="h-4 w-4 text-slate-900" />}
                classNames={{ base: 'shrink-0', wrapper: 'mr-0 bg-emerald-500/40 group-data-[selected=true]:bg-orange-500 motion-reduce:transition-none', thumb: 'shadow-md motion-reduce:transition-none' }}
              />
            </div>
            <p id="lesson-access-default-help" className="mt-3 text-xs leading-5 text-slate-500">Choose Free or Paid for new lessons. Change existing lessons individually below.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Publication status</p><p className="mt-2 font-semibold capitalize text-white">{status.replace("_", " ")}</p><p className="mt-1 text-xs text-slate-400">Drafts are hidden from regular app users. Coming soon shows book details without lesson audio.</p></div>
        </div>
        {status === "live" && completeness.lessonCount === 0 ? <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-100">Add at least one complete lesson before publishing.</p> : null}
      </Card>

      <Card as="section" shadow="none" className={cardClass} aria-labelledby="lessons-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="lessons-heading" className="text-lg font-semibold">Lessons</h2><p className="mt-1 text-sm text-slate-400">Add as many ordered lessons as needed. Listen to each clip before saving.</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{lessons.length} lesson{lessons.length === 1 ? "" : "s"}</span></div>
        {fieldErrors.lessons ? <p className="mb-4 text-sm text-rose-300" role="alert">{fieldErrors.lessons}</p> : null}
        {lessons.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 bg-black/10 px-5 py-8 text-center"><p className="font-medium text-slate-200">No lessons added yet</p><p className="mt-1 text-sm text-slate-500">Add a lesson card, then choose an MP3 file.</p></div> : <div className="space-y-4">{lessons.map((lesson, index) => <div key={index}>{fieldErrors[`lesson-${index}`] ? <p className="mb-2 text-sm text-rose-300" role="alert">{fieldErrors[`lesson-${index}`]}</p> : null}<LessonCard bookCoverUrl={selectedCoverUrl || coverUrl} lesson={lesson} index={index} total={lessons.length} onChange={(patch) => updateLesson(index, patch)} onRemove={() => setLessons((current) => current.filter((_, i) => i !== index))} onMove={(direction) => moveLesson(index, direction)} /></div>)}</div>}
        <AdminButton type="button" onClick={async () => { if (await confirm({ title: 'Add a lesson?', description: 'Add a new lesson to this book? Save the book after adding its details and audio.', confirmLabel: 'Add lesson' })) setLessons((current) => [...current, emptyLesson(current.length, type)]); }} className="mt-4 rounded-xl border border-dashed border-orange-300/30 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-300/5">+ Add lesson</AdminButton>
        <p className="mt-4 text-xs text-slate-500">Each lesson keeps its own access and thumbnail when reordered. Lessons without a custom thumbnail use the book cover.</p>
      </Card>

      <footer className="sticky bottom-3 z-10 rounded-2xl border border-white/10 bg-[#0b0f17]/95 p-3 shadow-2xl backdrop-blur sm:flex sm:items-center sm:justify-between sm:p-4">
        <div className="mb-3 min-h-5 text-xs text-slate-400 sm:mb-0" aria-live="polite">{saving ? `Saving book… ${saveProgress}%` : "Your form stays open if saving or upload needs to be retried."}{saving ? <AdminProgress className="ml-3 h-2 w-28 accent-orange-400" max={100} value={saveProgress} /> : null}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <AdminButton type="button" disabled={saving} onClick={() => void save(editing ? status : "draft")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">{editing ? "Save changes" : "Save draft"}</AdminButton>
          {!editing || status !== "coming_soon" ? <AdminButton type="button" disabled={saving} onClick={() => void save("coming_soon")} className="rounded-xl border border-amber-300/25 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-300/10 disabled:opacity-50">Coming soon</AdminButton> : null}
          {editing && status === "live" ? <AdminButton type="button" disabled={saving} onClick={() => void save("draft")} className="rounded-xl border border-rose-300/25 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-300/10 disabled:opacity-50">Unpublish</AdminButton> : null}
          {status !== "live" ? <AdminButton type="button" disabled={saving} onClick={() => void save("live")} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/30 hover:bg-orange-400 disabled:opacity-50">Publish</AdminButton> : null}
        </div>
      </footer>
    </main>
  );
}
