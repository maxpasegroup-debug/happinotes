"use client";

import Image from "next/image";
import LanguagePicker from "@/components/admin/LanguagePicker";
import { motion, useReducedMotion } from "framer-motion";



import AdminModal from "@/components/admin/AdminModal";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { addToast, Card, Chip, Skeleton, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, ModalContent, ModalBody, Pagination, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";

import { AdminButton, AdminCheckbox, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/ui";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, downloadCsv, uploadMultipart } from "@/lib/api";

type Status = "draft" | "coming_soon" | "live";
type Kind = "lifebook" | "note" | "silence";
const USERS_PER_PAGE = 7;
const BOOKS_PER_PAGE = 6;

type Content = {
  _id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  contentType: Kind;
  type: "free" | "premium";
  priceInr?: number;
  lessons?: Array<{ title?: string; description?: string; mediaUrl?: string; mediaType?: "audio" | "video" }>;
  status: Status;
  featured?: boolean;
  webDisplayOrder?: number;
  mobileDisplayOrder?: number;
  createdAt?: string;
};

function LibraryIcon({ name, className = "h-5 w-5" }: { name: "book" | "search" | "plus"; className?: string }) {
  const paths = { book: "M12 5v15M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z", search: "m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", plus: "M12 5v14M5 12h14" };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function StoryBooksSkeleton() {
  return <div role="status" aria-label="Loading Life Books" aria-busy="true" className="space-y-6">
    <span className="sr-only">Loading your Life Book library…</span>
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl motion-reduce:before:animate-none" />)}</div>
    <div aria-hidden="true" className="flex flex-wrap justify-between gap-3"><Skeleton className="h-11 w-80 max-w-full rounded-xl motion-reduce:before:animate-none" /><Skeleton className="h-11 w-64 max-w-full rounded-xl motion-reduce:before:animate-none" /></div>
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-divider bg-content1"><div className="grid min-w-[920px] grid-cols-[2.5fr_1fr_1fr_.7fr_1fr_1fr_1fr] gap-4 bg-content2 px-5 py-4">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-3 rounded motion-reduce:before:animate-none" />)}</div>{Array.from({ length: 6 }, (_, index) => <div key={index} className="grid min-w-[920px] grid-cols-[2.5fr_1fr_1fr_.7fr_1fr_1fr_1fr] items-center gap-4 border-t border-divider/60 px-5 py-4"><div className="flex items-center gap-3"><Skeleton className="h-12 w-9 rounded-md motion-reduce:before:animate-none" /><Skeleton className={`h-4 rounded motion-reduce:before:animate-none ${index % 2 ? 'w-36' : 'w-52'}`} /></div><Skeleton className="h-6 w-20 rounded-full motion-reduce:before:animate-none" /><Skeleton className="h-6 w-16 rounded-full motion-reduce:before:animate-none" /><Skeleton className="h-4 w-8 rounded motion-reduce:before:animate-none" /><Skeleton className="h-5 w-16 rounded-full motion-reduce:before:animate-none" /><Skeleton className="h-3 w-20 rounded motion-reduce:before:animate-none" /><Skeleton className="h-8 w-24 rounded-lg motion-reduce:before:animate-none" /></div>)}</div>
  </div>;
}

function MiniStatusChart({ count, total, values, activeIndex, tone }: { count: number; total: number; values: number[]; activeIndex: number; tone: "orange" | "green" | "slate" | "amber" }) {
  const colors = { orange: "#fb923c", green: "#34d399", slate: "#94a3b8", amber: "#fbbf24" };
  const color = colors[tone];
  const width = 132;
  const height = 44;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({ x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width, y: 36 - (value / max) * 27 }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const activePoint = points[activeIndex] ?? points.at(-1) ?? { x: width, y: height };
  return <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-4 w-[132px] opacity-90 transition-transform duration-300 group-hover:translate-y-[-2px]">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full overflow-visible">
      <defs><linearGradient id={`story-wave-${tone}-${activeIndex}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#story-wave-${tone}-${activeIndex})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: .25 }} animate={{ pathLength: 1, opacity: .9 }} transition={{ duration: .7, ease: "easeOut" }} />
      <circle cx={activePoint.x} cy={activePoint.y} r="3" fill={color} stroke="#18181b" strokeWidth="1.5" />
    </svg>
    <span className="sr-only">{count} of {total} books represented in this status wave</span>
  </div>;
}

function UsersSkeleton() {
  return (
    <div role="status" aria-label="Loading users" aria-busy="true" className="mx-3 min-w-0 rounded-xl border border-divider bg-content1 sm:mx-4">
      <span className="sr-only">Loading user accounts…</span>
      <div aria-hidden="true" className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-6 rounded-lg bg-content2 px-3 py-3">
            {['Email', 'Join date', 'Blocked', 'Actions'].map(label => <span key={label} className="text-xs text-default-400">{label}</span>)}
          </div>
          {Array.from({ length: USERS_PER_PAGE }, (_, index) => (
            <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-6 border-b border-divider/60 px-3 py-4 last:border-0">
              <Skeleton className={`h-4 rounded motion-reduce:before:animate-none ${index % 2 ? 'w-4/5' : 'w-full max-w-56'}`} />
              <Skeleton className="h-4 w-20 rounded motion-reduce:before:animate-none" />
              <Skeleton className="h-6 w-16 rounded-full motion-reduce:before:animate-none" />
              <Skeleton className="h-8 w-20 rounded-md motion-reduce:before:animate-none" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-4 sm:px-8 lg:px-10">
        <Skeleton className="h-3 w-44 rounded motion-reduce:before:animate-none" />
        <div className="flex gap-1">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-8 rounded-lg motion-reduce:before:animate-none" />)}</div>
      </div>
    </div>
  );
}

function BookCover({ item, compact = false }: { item: Pick<Content, "title" | "thumbnailUrl" | "coverImageUrl">; compact?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = item.thumbnailUrl || item.coverImageUrl;
  return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-divider bg-gradient-to-br from-orange-400/10 to-slate-800 text-orange-700 dark:text-orange-300/60 shadow-md ${compact ? 'h-12 w-9 rounded-md' : 'h-36 w-24 rounded-xl'}`}>
    {src && failedSource !== src ? <Image unoptimized fill sizes="96px" src={src} alt={item.title} className="object-contain" onError={() => setFailedSource(src)} /> : <LibraryIcon name="book" className="h-9 w-9" />}
  </div>;
}

type User = {
  id?: string;
  _id?: string;
  email: string;
  createdAt?: string;
  blocked?: boolean;
};

type LifebookSection = {
  title?: string;
  description?: string;
  mediaUrl?: string;
  mediaType?: "audio" | "video";
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

type ModuleKey = "lifebooks" | "notes" | "happiness" | "users" | "business" | "app_views";

type ChapterDraft = {
  title: string;
  description: string;
  file: File | null;
  mediaUrl?: string;
  mediaType?: "audio" | "video";
  uploading?: boolean;
};

type ContentForm = {
  title: string;
  description: string;
  status: Status;
  type: "free" | "premium";
  priceInr: string;
  language: string;
  category: string;
  featured: boolean;
  thumbnail: File | null;
  media: File | null;
  introTitle: string;
  introDescription: string;
  introMedia: File | null;
  introMediaUrl?: string;
  introMediaType?: "audio" | "video";
  introUploading?: boolean;
  chapters: ChapterDraft[];
  mediaUploadedUrl?: string;
  mediaUploadedType?: "audio" | "video";
  mediaUploading?: boolean;
};

type Step = 1 | 2 | 3 | 4;

const MEDIA_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://happinotes-production-6b44.up.railway.app";

function mediaUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = value.trim();
  if (url.startsWith("/")) return `${MEDIA_API_BASE}${url}`;
  if (url.startsWith("uploads/")) return `${MEDIA_API_BASE}/${url}`;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^http:\/\//i.test(url) && /railway\.app\//i.test(url)) return url.replace(/^http:/i, "https:");
  if (!/^https?:\/\//i.test(url) && /railway\.app\//i.test(url)) return `https://${url}`;
  return url;
}

function emptyForm(): ContentForm {
  return {
    title: "",
    description: "",
    status: "live",
    type: "free",
    priceInr: "",
    language: "English",
    category: "General",
    featured: false,
    thumbnail: null,
    media: null,
    introTitle: "Introduction",
    introDescription: "",
    introMedia: null,
    introMediaUrl: "",
    introMediaType: undefined,
    introUploading: false,
    chapters: [{ title: "Episode 1", description: "", file: null, mediaUrl: "", mediaType: undefined, uploading: false }],
    mediaUploadedUrl: "",
    mediaUploadedType: undefined,
    mediaUploading: false,
  };
}

export default function ContentManagement({ activeModule }: { activeModule: ModuleKey }) {
  const confirm = useAdminConfirmation();
  const router = useRouter();
  const [contents, setContents] = useState<Content[]>([]);
  const reducedMotion = useReducedMotion();
  const [bookSearch, setBookSearch] = useState("");
  const [bookStatus, setBookStatus] = useState<"all" | Status>("all");
  const [bookAccess, setBookAccess] = useState("all");
  const [booksPage, setBooksPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const usersPageCount = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const currentUsersPage = Math.min(usersPage, usersPageCount);
  const usersStart = (currentUsersPage - 1) * USERS_PER_PAGE;
  const visibleUsers = users.slice(usersStart, usersStart + USERS_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [exportingBooks, setExportingBooks] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<Kind>("lifebook");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [form, setForm] = useState<ContentForm>(emptyForm());
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [viewPlatform, setViewPlatform] = useState<"web" | "mobile">("web");
  const [webViewport, setWebViewport] = useState<"mobile" | "desktop">("desktop");
  const [arrangeCategory, setArrangeCategory] = useState<"all" | Status | "free" | "premium">("all");
  const [arrangeDraft, setArrangeDraft] = useState<Content[]>([]);
  const [arrangeSaving, setArrangeSaving] = useState(false);
  useEffect(() => {
    if (!message) return;
    const failure = /could not|failed|required|missing|must |requires|add at least/i.test(message);
    const progress = /saving|uploading/i.test(message);
    addToast({ title: failure ? "Action needs attention" : progress ? "Working" : "Updated", description: message, severity: failure ? "danger" : progress ? "default" : "success", timeout: progress ? 2200 : 4000, shouldShowTimeoutProgress: true });
  }, [message]);

  async function uploadSingleMedia(file: File, scope: "intro" | "lesson" | "note" | "silence") {
    const token = window.localStorage.getItem("admin_token") || "";
    if (!token) throw new Error("Admin token missing");
    if (!await confirm({ title: "Upload media?", description: `Upload “${file.name}” (${(file.size / 1024 / 1024).toFixed(1)} MB)? Save the content afterward to keep this file.`, confirmLabel: "Upload file" })) return null;
    const fd = new FormData();
    fd.append("media", file);
    fd.append("scope", scope);
    const payload = await uploadMultipart<{ message?: string; url?: string; mediaType?: "audio" | "video" }>(
      "/admin/contents/upload-media", fd, token,
    );
    if (!payload.url || !payload.mediaType) {
      throw new Error("The upload could not be completed. Please try again.");
    }
    return payload;
  }

  async function load() {
    try {
      const token = window.localStorage.getItem("admin_token") || "";
      const [c, u] = await Promise.all([
        apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token),
        apiRequest<{ users: User[] }>("/admin/users", "GET", undefined, token),
      ]);
      setContents((c.contents || []).map((item) => ({
        ...item,
        // Older book records use coverImageUrl; keep one canonical field for
        // both the cards and the edit dialog.
        thumbnailUrl: mediaUrl(item.thumbnailUrl || item.coverImageUrl),
        coverImageUrl: mediaUrl(item.coverImageUrl),
      })));
      setUsers(u.users || []);
      setUsersPage((page) => Math.min(page, Math.max(1, Math.ceil((u.users || []).length / USERS_PER_PAGE))));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setMessage("Could not load this section. Please refresh and try again.");
      throw error;
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    const refresh = () => load().catch(() => undefined);
    window.addEventListener("happinotes:catalog-changed", refresh);
    return () => window.removeEventListener("happinotes:catalog-changed", refresh);
  }, []);

  const lifebooks = useMemo(
    () =>
      [...contents]
        .filter((x) => x.contentType === "lifebook")
        .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [contents]
  );
  function exportBooks() {
    if (exportingBooks || !lifebooks.length) return;
    setExportingBooks(true);
    try {
      downloadCsv(`happinotes-story-books-${new Date().toISOString().slice(0, 10)}.csv`, ['ID', 'Title', 'Description', 'Content type', 'Access', 'Status', 'Featured', 'Web order', 'Mobile order', 'Thumbnail URL', 'Cover URL', 'Lesson count', 'Lessons', 'Created at'], lifebooks.map((book) => [book._id, book.title, book.description, book.contentType, book.type, book.status, book.featured, book.webDisplayOrder, book.mobileDisplayOrder, book.thumbnailUrl, book.coverImageUrl, book.lessons?.length || 0, book.lessons, book.createdAt]));
      setMessage(`Exported ${lifebooks.length} Life Book${lifebooks.length === 1 ? '' : 's'} to CSV.`);
    } finally {
      setExportingBooks(false);
    }
  }
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

  useEffect(() => {
    const key = viewPlatform === "web" ? "webDisplayOrder" : "mobileDisplayOrder";
    const sorted = [...lifebooks].sort((a, b) => {
      const ao = typeof a[key] === "number" ? (a[key] as number) : Number.MAX_SAFE_INTEGER;
      const bo = typeof b[key] === "number" ? (b[key] as number) : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "");
    });
    setArrangeDraft(sorted);
  }, [lifebooks, viewPlatform]);

  async function openCreate(kind: Kind) {
    if (!await confirm({ title: "Add new content?", description: "Open the editor to create a new book. Nothing is published until you save and publish it.", confirmLabel: "Continue" })) return;
    if (kind === "lifebook") {
      router.push("/admin/content/new");
      return;
    }
    setCreateKind(kind);
    setForm(emptyForm());
    setMessage("");
    setStep(1);
    setCreateOpen(true);
  }

  async function openEdit(item: Content) {
    if (!await confirm({ title: "Edit content?", description: `Open “${item.title}” for editing? Changes take effect only after you save.`, confirmLabel: "Edit content" })) return;
    if (item.contentType === "lifebook") {
      router.push(`/admin/content/${item._id}/edit`);
      return;
    }
    setMessage("");
    setEditing(item);
    const next = emptyForm();
    next.title = item.title || "";
    next.description = item.description || "";
    next.status = item.status || "coming_soon";
    next.type = item.type || "free";
    next.priceInr = typeof item.priceInr === "number" ? String(item.priceInr) : "";
    next.featured = Boolean(item.featured);
    if (item.contentType === "silence") next.category = "General";

    const token = window.localStorage.getItem("admin_token") || "";
    // The admin collection already contains the full episode list. Prefer it
    // here so premium episodes are not hidden by the public catalogue shaping.
    const inlineDetail = item as Content & DetailResponse["content"];
    const details = inlineDetail.lessons || inlineDetail.intro || inlineDetail.conclusion
      ? { content: inlineDetail }
      : await apiRequest<DetailResponse>(`/contents/${item._id}`, "GET", undefined, token).catch(
          () => ({ content: undefined })
        );
    const detail = details.content;
    if (detail?.intro) {
      next.introTitle = detail.intro.title || "Introduction";
      next.introDescription = detail.intro.description || "";
      next.introMediaUrl = detail.intro.mediaUrl || "";
      next.introMediaType = detail.intro.mediaType;
    }
    if (detail?.lessons && detail.lessons.length > 0) {
      next.chapters = detail.lessons.map((lesson, index) => ({
        title: lesson.title || `Episode ${index + 1}`,
        description: lesson.description || "",
        file: null,
        mediaUrl: lesson.mediaUrl || "",
        mediaType: lesson.mediaType,
        uploading: false,
      }));
    }
    if (detail?.category) next.category = detail.category;
    setForm(next);
    setStep(1);
    setEditOpen(true);
  }

  async function removeContent(id: string) {
    const ok = await confirm({ title: "Delete content?", description: `Permanently delete “${contents.find((item) => item._id === id)?.title || "this content"}”? This cannot be undone.`, confirmLabel: "Delete content", tone: "danger" });
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
    const title = contents.find((item) => item._id === id)?.title || 'this content';
    const ok = await confirm({
      title: status === 'live' ? 'Publish content?' : status === 'coming_soon' ? 'Mark as coming soon?' : 'Move to draft?',
      description: status === 'live' ? `Publish “${title}” to the app now? Existing access rules still apply.` : status === 'coming_soon' ? `“${title}” will show as coming soon. Lesson audio will not be available to listeners.` : `“${title}” will be hidden from listeners until it is published again.`,
      confirmLabel: status === 'live' ? 'Publish' : status === 'coming_soon' ? 'Coming soon' : 'Move to draft',
      tone: status === 'live' ? 'primary' : 'warning',
    });
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
    if (form.status === "live" && createKind === "lifebook" && !form.chapters[0]?.mediaUrl && !form.chapters[0]?.file) return setMessage("Add at least one episode MP3");
    if (form.status === "live" && createKind !== "lifebook" && !form.media && !form.mediaUploadedUrl) {
      return setMessage("Live note/happiness requires media audio");
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("language", form.language || "English");
    fd.append("contentType", createKind);
    fd.append("type", form.type);
    // Premium books are unlocked by the shared subscription plans.
    fd.append("priceInr", "0");
    fd.append("status", form.status);
    fd.append("featured", String(form.featured));
    fd.append("thumbnail", form.thumbnail);

    if (createKind === "lifebook") {
      fd.append(
        "intro",
        JSON.stringify({
          title: form.introTitle || "Introduction",
          description: form.introDescription || "",
          ...(form.introMediaUrl ? { mediaUrl: form.introMediaUrl } : {}),
          ...(form.introMediaType ? { mediaType: form.introMediaType } : {}),
        })
      );
      if (!form.introMediaUrl && form.introMedia) fd.append("introMedia", form.introMedia);
      const chapters = form.chapters
        .map((chapter, index) => ({
          title: chapter.title.trim() || `Episode ${index + 1}`,
          description: chapter.description.trim(),
          order: index,
          mediaUrl: chapter.mediaUrl || undefined,
          mediaType: chapter.mediaType || undefined,
          file: chapter.file,
        }))
        .filter((x) => Boolean(x.title || x.file || x.mediaUrl));
      if (chapters.length > 0) {
        fd.append(
          "lessons",
          JSON.stringify(chapters.map(({ title, description, order, mediaUrl, mediaType }) => ({ title, description, order, mediaUrl, mediaType })))
        );
        chapters.forEach((chapter) => {
          if (!chapter.mediaUrl && chapter.file) fd.append("lessonMedia", chapter.file);
        });
      }
    } else {
      if (createKind === "silence") fd.append("category", form.category || "General");
      if (form.mediaUploadedUrl && form.mediaUploadedType) {
        fd.append("mediaUrl", form.mediaUploadedUrl);
        fd.append("mediaType", form.mediaUploadedType);
      } else if (form.media) {
        fd.append("media", form.media);
      }
    }

    try {
      if (!await confirm({ title: editing ? "Save content changes?" : "Create content?", description: `Save “${form.title}” with the selected status and upload its selected files?`, confirmLabel: editing ? "Save changes" : "Create content" })) return;
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
    fd.append("priceInr", "0");
    fd.append("featured", String(form.featured));
    if (form.thumbnail) fd.append("thumbnail", form.thumbnail);

    if (editing.contentType === "lifebook") {
      if (form.introMedia || form.introMediaUrl || form.introTitle.trim()) {
        fd.append(
          "intro",
          JSON.stringify({
            title: form.introTitle.trim() || "Introduction",
            description: form.introDescription.trim(),
            ...(form.introMediaUrl ? { mediaUrl: form.introMediaUrl } : {}),
            ...(form.introMediaType ? { mediaType: form.introMediaType } : {}),
          })
        );
        if (!form.introMediaUrl && form.introMedia) fd.append("introMedia", form.introMedia);
      }
      const chapters = form.chapters
        .map((chapter, index) => ({
          title: chapter.title.trim() || `Episode ${index + 1}`,
          description: chapter.description.trim(),
          order: index,
          mediaUrl: chapter.mediaUrl || undefined,
          mediaType: chapter.mediaType || undefined,
          file: chapter.file,
        }))
        .filter((x) => Boolean(x.title || x.mediaUrl || x.file));
      if (chapters.length > 0) {
        fd.append(
          "lessons",
          JSON.stringify(chapters.map(({ title, description, order, mediaUrl, mediaType }) => ({ title, description, order, mediaUrl, mediaType })))
        );
        chapters.forEach((chapter) => {
          if (!chapter.mediaUrl && chapter.file) fd.append("lessonMedia", chapter.file);
        });
      }
    }
    if (editing.contentType !== "lifebook") {
      if (editing.contentType === "silence") fd.append("category", form.category || "General");
      if (form.mediaUploadedUrl && form.mediaUploadedType) {
        fd.append("mediaUrl", form.mediaUploadedUrl);
        fd.append("mediaType", form.mediaUploadedType);
      } else if (form.media) {
        fd.append("media", form.media);
      }
    }

    try {
      if (!await confirm({ title: editing ? "Save content changes?" : "Create content?", description: `Save “${form.title}” with the selected status and upload its selected files?`, confirmLabel: editing ? "Save changes" : "Create content" })) return;
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

  async function userAction(id: string, action: "block" | "unblock") {
    const prompt = action === "block" ? "Block this user from access?" : "Unblock this user?";
    if (!await confirm({ title: action === "block" ? "Block user?" : "Unblock user?", description: prompt, confirmLabel: action === "block" ? "Block user" : "Unblock user", tone: action === "block" ? "danger" : "primary" })) return;
    const token = window.localStorage.getItem("admin_token") || "";
    setBusyId(id);
    try {
      await apiRequest(`/admin/users/${id}/${action}`, "PATCH", undefined, token);
      setMessage(action === "block" ? "User blocked" : "User unblocked");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "User action failed");
    } finally {
      setBusyId(null);
    }
  }

  function moveArrangementItem(fromId: string, toId: string) {
    setArrangeDraft((prev) => {
      const fromIndex = prev.findIndex((x) => x._id === fromId);
      const toIndex = prev.findIndex((x) => x._id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function saveArrangement() {
    if (!await confirm({ title: "Save display order?", description: `Apply this order to the ${viewPlatform} feed?`, confirmLabel: "Save order" })) return;
    const token = window.localStorage.getItem("admin_token") || "";
    if (!token) {
      setMessage("Admin token missing");
      return;
    }
    const orderKey = viewPlatform === "web" ? "webDisplayOrder" : "mobileDisplayOrder";
    try {
      setArrangeSaving(true);
      setMessage("Saving arrangement...");
      await Promise.all(
        arrangeDraft.map((item, idx) =>
          apiRequest(
            `/admin/contents/${item._id}`,
            "PUT",
            { contentType: "lifebook", [orderKey]: idx },
            token
          )
        )
      );
      await load();
      setMessage("Arrangement saved. User feeds will follow this order.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save arrangement");
    } finally {
      setArrangeSaving(false);
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

  const visibleBooks = activeList.filter(item =>
    (bookStatus === "all" || item.status === bookStatus) &&
    (bookAccess === "all" || item.type === bookAccess) &&
    item.title.toLowerCase().includes(bookSearch.trim().toLowerCase())
  );
  const booksPageCount = Math.max(1, Math.ceil(visibleBooks.length / BOOKS_PER_PAGE));
  const currentBooksPage = Math.min(booksPage, booksPageCount);
  const booksStart = (currentBooksPage - 1) * BOOKS_PER_PAGE;
  const paginatedBooks = visibleBooks.slice(booksStart, booksStart + BOOKS_PER_PAGE);
  const bookStatuses = [
    { key: "all", label: "All books", count: lifebooks.length },
    { key: "live", label: "Published", count: lifebooks.filter(item => item.status === "live").length },
    { key: "draft", label: "Drafts", count: lifebooks.filter(item => item.status === "draft").length },
    { key: "coming_soon", label: "Coming soon", count: lifebooks.filter(item => item.status === "coming_soon").length },
  ] as const;
  const isLifebookFlow = (createOpen ? createKind : editing?.contentType) === "lifebook";
  const isLiveFlow = form.status === "live";
  const arrangeVisible = useMemo(() => {
    return arrangeDraft.filter((item) => {
      if (arrangeCategory === "all") return true;
      if (arrangeCategory === "free" || arrangeCategory === "premium") return item.type === arrangeCategory;
      return item.status === arrangeCategory;
    });
  }, [arrangeDraft, arrangeCategory]);

  useEffect(() => {
    setBooksPage(1);
  }, [bookSearch, bookStatus, bookAccess]);

  return (
    <div className="w-full min-w-0 space-y-7">
      <header className={`flex flex-wrap items-start justify-between gap-4 ${activeModule === "users" ? "px-5 sm:px-8 lg:px-10" : ""}`}><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{activeModule === 'users' ? 'Account management' : 'Content management'}</p><h1 className="mt-2 text-3xl font-bold">{activeModule === 'users' ? 'Users' : 'Life Books'}</h1><p className="mt-2 text-sm text-default-400">{activeModule === 'users' ? 'Manage the people in your HappiNotes community.' : 'Create, publish and organize your Life Book library.'}</p></div>{activeModule === "lifebooks" ? <div className="flex flex-wrap gap-2"><AdminButton variant="bordered" disabled={loading || exportingBooks || !lifebooks.length} onPress={exportBooks}>{exportingBooks ? 'Exporting…' : 'Export CSV'}</AdminButton><AdminButton color="primary" disabled={loading} startContent={<LibraryIcon name="plus" className="h-4 w-4" />} onPress={() => void openCreate("lifebook")}>Add New Life Book</AdminButton></div> : null}</header>

      {activeModule === "lifebooks" && (loading ? <StoryBooksSkeleton /> : <motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Filter books by publication status">
          {bookStatuses.map((status, statusIndex) => { const tone: "orange" | "green" | "slate" | "amber" = status.key === "live" ? "green" : status.key === "coming_soon" ? "amber" : status.key === "draft" ? "slate" : "orange"; const chartValues = bookStatuses.map(entry => entry.count); return <button key={status.key} type="button" aria-pressed={bookStatus === status.key} onClick={() => setBookStatus(status.key)} className={`group relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:p-5 ${bookStatus === status.key ? "border-orange-400/30 bg-orange-400/[.08]" : "border-divider bg-content1 hover:border-divider"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-default-500 sm:text-sm">{status.label}</span><span className={`h-1.5 w-1.5 rounded-full ${status.key === "live" ? "bg-emerald-400" : status.key === "coming_soon" ? "bg-amber-400" : status.key === "draft" ? "bg-slate-500" : "bg-orange-400"}`} /></div><p className={`mt-3 text-2xl font-semibold tabular-nums sm:text-3xl ${bookStatus === status.key ? "text-orange-700 dark:text-orange-300" : "text-foreground"}`}>{status.count}</p><p className="mt-1 text-[10px] font-medium uppercase tracking-[.14em] text-default-500">{lifebooks.length ? `${Math.round((status.count / lifebooks.length) * 100)}% of library` : "No titles yet"}</p><MiniStatusChart count={status.count} total={lifebooks.length} values={chartValues} activeIndex={statusIndex} tone={tone} /></button>; })}
        </div>
        <section aria-labelledby="book-library-heading" className="min-w-0 space-y-4">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><div><h2 id="book-library-heading" className="text-lg font-semibold text-foreground">Your Life Book library</h2><p role="status" className="mt-1 text-xs text-default-500">Showing {visibleBooks.length} of {lifebooks.length} Life Books</p></div><div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto"><AdminInput aria-label="Search Life Books" placeholder="Search Life Book titles…" value={bookSearch} onChange={event => setBookSearch(event.target.value)} startContent={<LibraryIcon name="search" className="h-4 w-4 shrink-0 text-default-500" />} className="w-full xl:w-72" /><AdminSelect aria-label="Filter Life Books by access" value={bookAccess} onChange={event => setBookAccess(event.target.value)} className="w-full sm:w-44"><option value="all">All access</option><option value="free">Free</option><option value="premium">Premium</option></AdminSelect></div></div>
          {visibleBooks.length ? <div className="overflow-hidden rounded-2xl border border-divider bg-content1 shadow-sm">
            <div className="overflow-x-auto">
              <Table aria-label="Life Books library" removeWrapper className="min-w-[920px]" classNames={{ table: "w-full", th: "h-12 bg-content2 px-4 text-[10px] font-bold uppercase tracking-[.12em] text-default-400 first:pl-5 last:pr-5", td: "border-b border-divider/60 px-4 py-3.5 first:pl-5 last:pr-5 last:border-0" }}>
                <TableHeader>
                  <TableColumn>Life Book</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Access</TableColumn>
                  <TableColumn>Lessons</TableColumn>
                  <TableColumn>Visibility</TableColumn>
                  <TableColumn>Created</TableColumn>
                  <TableColumn align="end">Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {paginatedBooks.map(item => <TableRow key={item._id} className="group hover:bg-content2/40">
                    <TableCell>
                      <div className="flex min-w-[260px] items-center gap-3">
                        <BookCover item={item} compact />
                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground" title={item.title}>{item.title}</p><p className="mt-1 truncate text-[11px] text-default-400">{item.contentType === 'lifebook' ? 'Life Book' : item.contentType}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><Badge text={item.status === 'live' ? 'Published' : item.status === 'coming_soon' ? 'Coming soon' : 'Draft'} tone={item.status === 'live' ? 'green' : item.status === 'coming_soon' ? 'amber' : 'gray'} /></TableCell>
                    <TableCell><Badge text={item.type === 'premium' ? 'Premium' : 'Free'} tone={item.type === 'premium' ? 'purple' : 'blue'} /></TableCell>
                    <TableCell><span className="text-sm tabular-nums text-default-600">{item.lessons?.length || 0}</span></TableCell>
                    <TableCell>{item.featured ? <Chip size="sm" variant="flat" color="warning">Featured</Chip> : <span className="text-xs text-default-400">Standard</span>}</TableCell>
                    <TableCell><span className="whitespace-nowrap text-xs text-default-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <AdminButton size="sm" variant="light" disabled={busyId === item._id} onPress={() => void openEdit(item)} aria-label={`Edit ${item.title}`}>Edit</AdminButton>
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger><Button isIconOnly size="sm" variant="light" aria-label={`More actions for ${item.title}`} className="admin-menu-icon text-default-500">•••</Button></DropdownTrigger>
                          <DropdownMenu aria-label={`Actions for ${item.title}`} onAction={(key) => {
                            if (key === 'delete') void removeContent(item._id);
                            if (key === 'publish') void setStatus(item._id, 'live');
                            if (key === 'coming') void setStatus(item._id, 'coming_soon');
                          }}>
                            {[
                              ...(item.status !== 'live' ? [<DropdownItem key="publish" aria-label={`Publish ${item.title}`} color="success">Publish</DropdownItem>] : []),
                              ...(item.status !== 'coming_soon' ? [<DropdownItem key="coming" aria-label={`Mark as coming soon: ${item.title}`} color="warning">Mark coming soon</DropdownItem>] : []),
                              <DropdownItem key="delete" aria-label={`Delete ${item.title}`} color="danger" className="text-danger">Delete</DropdownItem>,
                            ]}
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3"><p className="text-xs text-default-400">Showing {visibleBooks.length ? booksStart + 1 : 0}–{Math.min(booksStart + BOOKS_PER_PAGE, visibleBooks.length)} of {visibleBooks.length} filtered Life Books</p><div className="flex items-center gap-4"><span className="hidden text-[11px] text-default-400 sm:inline">Use Actions for publishing and deletion</span>{booksPageCount > 1 ? <Pagination aria-label="Life Books pagination" page={currentBooksPage} total={booksPageCount} onChange={setBooksPage} showControls isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} /> : null}</div></div>
          </div> : <div className="flex flex-col items-center rounded-2xl border border-dashed border-divider bg-content1/50 px-6 py-12 text-center"><LibraryIcon name="book" className="mb-4 h-9 w-9 text-orange-700 dark:text-orange-300/60" /><h3 className="font-semibold text-foreground">{lifebooks.length ? "No Life Books match your filters" : "Your library starts here"}</h3><p className="mt-2 text-sm text-default-500">{lifebooks.length ? "Try another title, publication status, or access type." : "Create your first Life Book to start building your library."}</p>{lifebooks.length ? <AdminButton variant="light" className="mt-4" onPress={() => { setBookSearch(""); setBookStatus("all"); setBookAccess("all"); }}>Clear filters</AdminButton> : <AdminButton color="primary" className="mt-4" onPress={() => void openCreate("lifebook")}>Add New Life Book</AdminButton>}</div>}
        </section>
      </motion.div>)}

      {activeModule === "app_views" && (
        <Card as="div" shadow="none" className="space-y-4 rounded-2xl border border-divider bg-content1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold text-foreground">App Views & Content Arrangement</h2>
              <p className="mt-1 text-xs text-default-600">
                Set user-facing order for web and mobile feeds. Drag, arrange, and save.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                type="button"
                onClick={() => setViewPlatform("web")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  viewPlatform === "web"
                    ? "border-divider bg-content1 text-foreground"
                    : "border-divider bg-content1 text-default-600"
                }`}
              >
                Web App View
              </AdminButton>
              <AdminButton
                type="button"
                onClick={() => setViewPlatform("mobile")}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  viewPlatform === "mobile"
                    ? "border-divider bg-content1 text-foreground"
                    : "border-divider bg-content1 text-default-600"
                }`}
              >
                Mobile App View
              </AdminButton>
            </div>
          </div>

          {viewPlatform === "web" ? (
            <Card as="div" shadow="none" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-content1 p-3">
              <div className="flex gap-2">
                <AdminButton
                  type="button"
                  onClick={() => setWebViewport("desktop")}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    webViewport === "desktop"
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "border-divider text-default-600"
                  }`}
                >
                  Desktop View
                </AdminButton>
                <AdminButton
                  type="button"
                  onClick={() => setWebViewport("mobile")}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    webViewport === "mobile"
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "border-divider text-default-600"
                  }`}
                >
                  Mobile View
                </AdminButton>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-divider px-3 py-1.5 text-xs text-foreground hover:bg-foreground/5"
              >
                Open Web Preview
              </a>
            </Card>
          ) : (
            <Card as="div" shadow="none" className="rounded-xl border border-divider bg-content1 p-3 text-xs text-default-600">
              Mobile app feed order will use this arrangement. Changes become visible after mobile refresh.
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "All" },
                { key: "live", label: "Live" },
                { key: "coming_soon", label: "Coming Soon" },
                { key: "free", label: "Free" },
                { key: "premium", label: "Premium" },
              ].map((chip) => (
                <AdminButton
                  key={chip.key}
                  type="button"
                  onClick={() => setArrangeCategory(chip.key as "all" | Status | "free" | "premium")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    arrangeCategory === chip.key
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "border-divider text-default-600"
                  }`}
                >
                  {chip.label}
                </AdminButton>
              ))}
            </div>
            <AdminButton
              type="button"
              onClick={saveArrangement}
              disabled={arrangeSaving}
              className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60"
            >
              {arrangeSaving ? "Saving..." : "Save Order"}
            </AdminButton>
          </div>

          <div className="overflow-hidden rounded-xl border border-divider">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-content1">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-default-600">Order</th>
                  <th className="px-3 py-2 text-left text-xs text-default-600">Title</th>
                  <th className="px-3 py-2 text-left text-xs text-default-600">Category</th>
                  <th className="px-3 py-2 text-left text-xs text-default-600">Type</th>
                  <th className="px-3 py-2 text-left text-xs text-default-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {arrangeVisible.map((item, index) => (
                  <tr
                    key={item._id}
                    draggable={arrangeCategory === "all"}
                    onDragStart={(e) => {
                      if (arrangeCategory !== "all") return;
                      e.dataTransfer.setData("text/plain", item._id);
                    }}
                    onDragOver={(e) => {
                      if (arrangeCategory !== "all") return;
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (arrangeCategory !== "all") return;
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData("text/plain");
                      moveArrangementItem(fromId, item._id);
                    }}
                    className="cursor-move border-t border-divider hover:bg-foreground/[0.02]"
                  >
                    <td className="px-3 py-2 text-xs text-default-600">{index + 1}</td>
                    <td className="px-3 py-2 text-foreground">{item.title}</td>
                    <td className="px-3 py-2 text-default-600">Lifebooks</td>
                    <td className="px-3 py-2">
                      <Badge text={item.type} tone={item.type === "premium" ? "purple" : "blue"} />
                    </td>
                    <td className="px-3 py-2">
                      <Badge text={item.status} tone={item.status === "live" ? "green" : item.status === "coming_soon" ? "amber" : "gray"} />
                    </td>
                  </tr>
                ))}
                {arrangeVisible.length === 0 ? (
                  <tr className="border-t border-divider">
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-default-600">
                      No items found for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {arrangeCategory !== "all" ? (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Drag and drop is enabled only on &quot;All&quot; filter to preserve a single global order.
            </p>
          ) : null}
        </Card>
      )}

      {activeModule === "users" && (loading ? <UsersSkeleton /> : <Card as="div" shadow="none" className="mx-3 min-w-0 rounded-xl border border-divider bg-content1 sm:mx-4">
          <div className="w-full overflow-x-auto">
          <Table aria-label="User accounts" className="w-full min-w-[600px]" removeWrapper classNames={{ table: "w-full", th: "bg-content2 text-default-400 first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 lg:first:pl-10 lg:last:pr-10", td: "py-4 first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 lg:first:pl-10 lg:last:pr-10" }}>
            <TableHeader>
                {["Email", "Join date", "Blocked", "Actions"].map((h) => (
                  <TableColumn key={h} className="px-3 py-3 text-left text-xs text-default-600">
                    {h}
                  </TableColumn>
                ))}
              </TableHeader>
            <TableBody emptyContent="No user accounts found.">
              {visibleUsers.map((u) => {
                const id = u.id || u._id || "";
                return (
                  <TableRow key={id} className="border-t border-divider">
                    <TableCell className="px-3 py-3 text-foreground">{u.email}</TableCell>
                    <TableCell className="px-3 py-3 text-default-600">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="px-3 py-3">
                      <Badge text={u.blocked ? "Blocked" : "No"} tone={u.blocked ? "rose" : "blue"} />
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="flex gap-2">
                        <AdminButton
                          onClick={() => userAction(id, u.blocked ? "unblock" : "block")}
                          disabled={busyId === id}
                          className="rounded-md border border-divider px-3 py-1.5 text-xs text-foreground hover:bg-foreground/5"
                        >
                        {u.blocked ? "Unblock" : "Block"}
                        </AdminButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-4 sm:px-8 lg:px-10">
            <p role="status" aria-live="polite" className="text-xs text-default-400">
              {users.length ? `Showing ${usersStart + 1}–${Math.min(usersStart + USERS_PER_PAGE, users.length)} of ${users.length} users` : '0 users'}
            </p>
            {usersPageCount > 1 ? <Pagination aria-label="Users pagination" page={currentUsersPage} total={usersPageCount} onChange={setUsersPage}
              showControls isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} /> : null}
          </div>
        </Card>
      )}

      {(createOpen || editOpen) && (
        <AdminModal aria-labelledby="content-editor-title" isOpen size="3xl" scrollBehavior="inside" isDismissable={false} isKeyboardDismissDisabled hideCloseButton backdrop="blur" classNames={{ base: "admin-ui border border-divider bg-content1 text-foreground" }}>
          <ModalContent><ModalBody className="p-6">
            <h3 id="content-editor-title" className="m-0 text-xl font-semibold text-foreground">
              {createOpen ? `Add ${createKind === "lifebook" ? "New Book" : createKind === "note" ? "Note" : "Happiness"}` : "Edit Content"}
            </h3>
            <p className="mt-2 text-sm text-default-600">
              {isLifebookFlow && isLiveFlow
                ? "Add the book details, cover image, and as many episode MP3 files as you need."
                : "Simple content flow: fill details and save"}
            </p>

            {false && isLifebookFlow && isLiveFlow ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <AdminButton
                    key={n}
                    type="button"
                    onClick={() => setStep(n as Step)}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      step === n
                        ? "border-[#f97316] bg-primary/10 text-foreground"
                        : "border-divider bg-content1 text-default-600"
                    }`}
                  >
                    {n === 1 ? "Basic" : n === 2 ? "Intro" : n === 3 ? "Episodes" : "Review"}
                  </AdminButton>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {(createOpen || editOpen) && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="grid gap-1 text-sm text-default-600">
                      <AdminSelect label="Status"
                        value={form.status}
                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Status }))}
                        className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                      >
                        <option value="coming_soon">Coming Soon</option>
                        <option value="live">Live</option>
                        <option value="draft">Draft</option>
                      </AdminSelect>
                    </div>
                    <div className="grid gap-1 text-sm text-default-600">
                      <AdminSelect label="Access"
                        value={form.type}
                        onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as "free" | "premium" }))}
                        className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </AdminSelect>
                    </div>
                  </div>
                  {form.type === "premium" ? (
                    <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                      Premium access is provided through the monthly subscription plan. This story has no individual price.
                    </p>
                  ) : null}
                  <label className="grid gap-1 text-sm text-default-600">
                    Title
                    <AdminInput
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                      className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-default-600">
                    Description
                    <AdminTextarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Description"
                      className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <LanguagePicker value={form.language} onChange={(language) => setForm((prev) => ({ ...prev, language }))} />
                    <AdminCheckbox
                      isSelected={form.featured}
                      onValueChange={(featured) => setForm((prev) => ({ ...prev, featured }))}
                      className="rounded-lg border border-divider bg-content1 px-3 py-2"
                    >Featured</AdminCheckbox>
                  </div>
                  <label className="grid gap-1 text-sm text-default-600">
                    Book Image
                    <AdminInput
                      type="file"
                      accept="image/*"
                      onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.files?.[0] || null }))}
                      className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                    />
                    <p className="text-xs text-default-600">{form.thumbnail?.name || (editing?.thumbnailUrl || editing?.coverImageUrl ? "Saved cover image attached" : "Choose a cover image")}</p>
                    {form.thumbnail ? <Image unoptimized width={80} height={112} src={URL.createObjectURL(form.thumbnail)} alt="Selected cover preview" className="mt-1 h-28 w-20 rounded-lg object-cover" /> : (editing?.thumbnailUrl || editing?.coverImageUrl) ? <Image unoptimized width={80} height={112} src={editing.thumbnailUrl || editing.coverImageUrl || ""} alt="Saved cover preview" className="mt-1 h-28 w-20 rounded-lg object-cover" /> : null}
                  </label>
                  {(createOpen ? createKind : editing?.contentType) === "silence" ? (
                    <label className="grid gap-1 text-sm text-default-600">
                      Category
                      <AdminInput
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Category"
                        className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                      />
                    </label>
                  ) : null}
                </>
              )}

              {false && isLifebookFlow && isLiveFlow && step === 2 ? (
                <>
                  <label className="grid gap-1 text-sm text-default-600">
                    Intro Title
                    <AdminInput
                      value={form.introTitle}
                      onChange={(e) => setForm((prev) => ({ ...prev, introTitle: e.target.value }))}
                      placeholder="Intro title"
                      className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-default-600">
                    Intro Audio/Video
                    <AdminInput
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          introMedia: e.target.files?.[0] || null,
                          introMediaUrl: "",
                          introMediaType: undefined,
                        }))
                      }
                      className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminButton
                      type="button"
                      disabled={!form.introMedia || Boolean(form.introUploading)}
                      onClick={async () => {
                        if (!form.introMedia) return;
                        setMessage("");
                        setForm((prev) => ({ ...prev, introUploading: true }));
                        try {
                          const uploaded = await uploadSingleMedia(form.introMedia, "intro");
                          if (!uploaded) return;
                          setForm((prev) => ({
                            ...prev,
                            introMediaUrl: uploaded.url,
                            introMediaType: uploaded.mediaType,
                            introUploading: false,
                          }));
                          setMessage("Intro uploaded.");
                        } catch (err) {
                          setForm((prev) => ({ ...prev, introUploading: false }));
                          setMessage(err instanceof Error ? err.message : "Intro upload failed");
                        }
                      }}
                      className="rounded-md border border-blue-400/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
                    >
                      {form.introUploading ? "Uploading..." : "Upload Intro Now"}
                    </AdminButton>
                    {form.introMediaUrl ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Intro ready for publish.</p> : null}
                  </div>
                </>
              ) : null}

              {isLifebookFlow && isLiveFlow ? (
                <>
                  {form.chapters.map((chapter, index) => (
                    <Card as="div" shadow="none" key={index} className="rounded-xl border border-divider bg-content1 p-3">
                      <p className="mb-2 text-xs font-semibold text-default-600">Episode {index + 1}</p>
                      <div className="grid gap-2">
                        <AdminInput
                          value={chapter.title}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)),
                            }))
                          }
                          placeholder={`Episode ${index + 1} title`}
                          className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                        />
                        <AdminTextarea
                          value={chapter.description}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.map((x, i) =>
                                i === index ? { ...x, description: e.target.value } : x
                              ),
                            }))
                          }
                          placeholder={`Episode ${index + 1} description`}
                          rows={3}
                          className="rounded-lg border border-divider bg-content1 px-3 py-2 text-sm text-foreground outline-none"
                        />
                        <p className="text-xs text-default-600">
                          {chapter.file?.name || (chapter.mediaUrl ? (chapter.mediaUrl.split("/").pop() || "Saved MP3 attached") : "Choose an MP3 file")}
                        </p>
                        {chapter.file || chapter.mediaUrl ? <audio controls preload="metadata" src={chapter.file ? URL.createObjectURL(chapter.file) : chapter.mediaUrl} className="w-full" /> : null}
                        <AdminInput
                          type="file"
                          accept="audio/*,.mp3,audio/mpeg"
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.map((x, i) =>
                                i === index
                                  ? {
                                      ...x,
                                      file: e.target.files?.[0] || null,
                                      mediaUrl: "",
                                      mediaType: undefined,
                                    }
                                  : x
                              ),
                            }))
                          }
                          className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminButton
                            type="button"
                            disabled={!chapter.file || Boolean(chapter.uploading)}
                            onClick={async () => {
                              if (!chapter.file) return;
                              setMessage("");
                              setForm((prev) => ({
                                ...prev,
                                chapters: prev.chapters.map((x, i) =>
                                  i === index ? { ...x, uploading: true } : x
                                ),
                              }));
                              try {
                                const uploaded = await uploadSingleMedia(chapter.file, "lesson");
                          if (!uploaded) return;
                                setForm((prev) => ({
                                  ...prev,
                                  chapters: prev.chapters.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          mediaUrl: uploaded.url,
                                          mediaType: uploaded.mediaType,
                                          uploading: false,
                                        }
                                      : x
                                  ),
                                }));
                                setMessage(`Episode ${index + 1} uploaded.`);
                              } catch (err) {
                                setForm((prev) => ({
                                  ...prev,
                                  chapters: prev.chapters.map((x, i) =>
                                    i === index ? { ...x, uploading: false } : x
                                  ),
                                }));
                                setMessage(err instanceof Error ? err.message : "Episode upload failed");
                              }
                            }}
                            className="rounded-md border border-blue-400/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
                          >
                            {chapter.uploading ? "Uploading..." : "Upload MP3"}
                          </AdminButton>
                          {chapter.mediaUrl ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Episode ready.</p> : null}
                        </div>
                        <AdminButton
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              chapters: prev.chapters.filter((_, i) => i !== index),
                            }))
                          }
                          className="w-fit rounded-md border border-rose-400/30 px-3 py-1 text-xs text-rose-700 dark:text-rose-200 hover:bg-rose-500/10"
                        >
                          Remove Episode
                        </AdminButton>
                      </div>
                    </Card>
                  ))}
                  <AdminButton
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        chapters: [...prev.chapters, { title: `Episode ${prev.chapters.length + 1}`, description: "", file: null, mediaUrl: "" }],
                      }))
                    }
                    className="w-fit rounded-md border border-divider px-3 py-2 text-xs text-foreground hover:bg-foreground/5"
                  >
                    + Add Episode MP3
                  </AdminButton>
                </>
              ) : null}

              {false && isLifebookFlow && isLiveFlow && step === 4 ? (
                <Card as="div" shadow="none" className="rounded-xl border border-divider bg-content1 p-4 text-sm text-default-600">
                  <p><strong>Title:</strong> {form.title || "-"}</p>
                  <p><strong>Status:</strong> {form.status}</p>
                  <p><strong>Type:</strong> {form.type}</p>
                  <p><strong>Intro File:</strong> {form.introMedia?.name || (form.introMediaUrl ? "Using existing intro media" : "Not attached")}</p>
                  <p><strong>Episodes:</strong> {form.chapters.length}</p>
                </Card>
              ) : null}

              {(!isLifebookFlow || !isLiveFlow) && (createOpen ? createKind : editing?.contentType) !== "lifebook" && form.status === "live" ? (
                <label className="grid gap-1 text-sm text-default-600">
                  Media (audio/video)
                  <AdminInput
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        media: e.target.files?.[0] || null,
                        mediaUploadedUrl: "",
                        mediaUploadedType: undefined,
                      }))
                    }
                    className="rounded-lg border border-divider bg-content1 px-3 py-2 text-foreground outline-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AdminButton
                      type="button"
                      disabled={!form.media || Boolean(form.mediaUploading)}
                      onClick={async () => {
                        if (!form.media) return;
                        const scope = (createOpen ? createKind : editing?.contentType) === "silence" ? "silence" : "note";
                        setMessage("");
                        setForm((prev) => ({ ...prev, mediaUploading: true }));
                        try {
                          const uploaded = await uploadSingleMedia(form.media, scope);
                          if (!uploaded) return;
                          setForm((prev) => ({
                            ...prev,
                            mediaUploadedUrl: uploaded.url,
                            mediaUploadedType: uploaded.mediaType,
                            mediaUploading: false,
                          }));
                          setMessage("Media uploaded.");
                        } catch (err) {
                          setForm((prev) => ({ ...prev, mediaUploading: false }));
                          setMessage(err instanceof Error ? err.message : "Media upload failed");
                        }
                      }}
                      className="rounded-md border border-blue-400/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-200 hover:bg-blue-500/10 disabled:opacity-60"
                    >
                      {form.mediaUploading ? "Uploading..." : "Upload Media Now"}
                    </AdminButton>
                    {form.mediaUploadedUrl ? <span className="text-xs text-emerald-700 dark:text-emerald-300">Media ready.</span> : null}
                  </div>
                </label>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <AdminButton
                  onClick={() => (createOpen ? submitCreate() : submitEdit())}
                  disabled={submitting}
                  className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-70"
                >
                  {submitting ? "Saving..." : createOpen ? "Create" : "Update"}
                </AdminButton>
                <AdminButton
                  onClick={() => {
                    setCreateOpen(false);
                    setEditOpen(false);
                    setEditing(null);
                    setMessage("");
                    setStep(1);
                  }}
                  className="rounded-lg border border-divider px-4 py-2 text-sm text-foreground hover:bg-foreground/5"
                >
                  Close
                </AdminButton>
                {false && isLifebookFlow && isLiveFlow && step > 1 ? (
                  <AdminButton
                    onClick={() => setStep((prev) => (Math.max(1, prev - 1) as Step))}
                    className="rounded-lg border border-divider px-4 py-2 text-sm text-foreground hover:bg-foreground/5"
                  >
                    Previous
                  </AdminButton>
                ) : null}
                {false && isLifebookFlow && isLiveFlow && step < 4 ? (
                  <AdminButton
                    onClick={() => setStep((prev) => (Math.min(4, prev + 1) as Step))}
                    className="rounded-lg border border-divider px-4 py-2 text-sm text-foreground hover:bg-foreground/5"
                  >
                    Next
                  </AdminButton>
                ) : null}
              </div>
            </div>
          </ModalBody></ModalContent>
        </AdminModal>
      )}
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: "green" | "amber" | "gray" | "purple" | "blue" | "rose" }) {
  const colors = { green: 'success', amber: 'warning', gray: 'default', purple: 'secondary', blue: 'primary', rose: 'danger' } as const;
  return <Chip size="sm" variant="flat" color={colors[tone]} className="capitalize">{text.replaceAll('_', ' ')}</Chip>;
}
