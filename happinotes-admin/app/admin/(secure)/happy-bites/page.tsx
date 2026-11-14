"use client";

import AdminModal from "@/components/admin/AdminModal";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { AdminButton, AdminInput, AdminTextarea, AdminSelect, AdminFieldset } from "@/components/admin/ui";

import { Card, Chip, ModalContent, ModalBody, ModalHeader, ModalFooter, Skeleton, Switch } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AudioPreview from "@/components/admin/AudioPreview";
import HappyBiteUpload, { type BiteUploadState } from "@/components/admin/HappyBiteUpload";
import { uploadHappyBiteChunks, type AudioUploadTicket } from "@/lib/happy-bite-upload";
import { apiRequest, uploadMultipart } from "@/lib/api";
import {
  BITE_CATEGORIES, EMPTY_BITE, detectAudioDuration, formatBiteDuration,
  uploadedAudioDuration, validateBiteDraft, validateBiteFile,
  type HappyBite, type HappyBiteDraft, type UploadKind,
} from "@/lib/happy-bites-admin";

const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-[#141418] px-3.5 py-3 text-sm text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/15 disabled:opacity-60";
const buttonClass = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-40";
const primaryClass = `${buttonClass} border-transparent bg-[#F27055] text-white hover:bg-[#DE6046]`;
const token = () => window.localStorage.getItem("admin_token") || "";
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const dateLabel = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Thumbnail({ src, title, large = false }: { src: string; title: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`relative shrink-0 overflow-hidden rounded-2xl bg-orange-500/10 ${large ? 'aspect-square w-full' : 'h-16 w-16'}`}>
    {src && !failed ? <Image unoptimized fill sizes={large ? "360px" : "64px"} src={src} alt={title} onError={() => setFailed(true)} className="object-cover" />
      : <div className="flex h-full items-center justify-center text-3xl text-orange-300" aria-label="Thumbnail placeholder">♪</div>}
  </div>;
}

function HappyBitesSkeleton() {
  return <div role="status" aria-label="Loading Happy Bites">
    <span className="sr-only">Loading Happy Bites…</span>
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((row) => <div key={row} className="border-b border-white/10 py-5 last:border-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Skeleton className="happy-bites-skeleton h-16 w-16 shrink-0 rounded-2xl motion-reduce:before:animate-none" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="happy-bites-skeleton h-5 w-56 max-w-full rounded-md motion-reduce:before:animate-none" />
              <Skeleton className="happy-bites-skeleton h-3 w-32 max-w-full rounded-md motion-reduce:before:animate-none" />
              <Skeleton className="happy-bites-skeleton h-3 w-44 max-w-full rounded-md motion-reduce:before:animate-none" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="happy-bites-skeleton h-6 w-14 rounded-full motion-reduce:before:animate-none" />
            <Skeleton className="happy-bites-skeleton h-6 w-20 rounded-full motion-reduce:before:animate-none" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((action) => <Skeleton key={action} className="h-10 w-20 rounded-xl motion-reduce:before:animate-none" />)}
        </div>
      </div>)}
    </div>
  </div>;
}

export default function HappyBitesAdminPage() {
  const confirm = useAdminConfirmation();
  const [items, setItems] = useState<HappyBite[]>([]);
  const [draft, setDraft] = useState<HappyBiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [uploads, setUploads] = useState<Partial<Record<UploadKind, BiteUploadState>>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deleteItem, setDeleteItem] = useState<HappyBite | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const locked = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => { uploadController.current?.abort(); }, []);
  const loadRequest = useRef(0);
  const busy = Boolean(operation);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    // Keep fast responses from removing the skeleton before it can be seen.
    // This runs alongside the request, so slower responses incur no extra delay.
    const minimumDisplay = new Promise<void>((resolve) => window.setTimeout(resolve, 450));
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ happyBites: HappyBite[] }>("/admin/happy-bites", "GET", undefined, token());
      if (request === loadRequest.current) setItems((result.happyBites || []).map((item) => ({ ...item, accessType: item.accessType ?? 'free' })));
    } catch (exception) {
      const message = errorMessage(exception);
      if (request === loadRequest.current) setError(message === 'Request failed with status 404'
        ? 'Happy Bites is not available on the connected server yet. Deploy the updated backend, then refresh this page.' : message);
    } finally {
      await minimumDisplay;
      if (request === loadRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { loadRequest.current += 1; };
  }, [load]);

  const categories = [...new Set([...BITE_CATEGORIES, ...items.map((item) => item.category)])].sort();
  const visibleItems = items.filter((item) =>
    (filter === 'all' || item.published === (filter === 'published')) &&
    (!categoryFilter || item.category === categoryFilter) &&
    `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(search.toLowerCase().trim()),
  );

  const openEditor = async (item?: HappyBite) => {
    if (locked.current) return;
    if (!await confirm({ title: item ? 'Edit Happy Bite?' : 'Create Happy Bite?', description: item ? `Open “${item.title}” for editing? You will confirm again before saving changes.` : 'Open a new Happy Bite draft? Nothing is published until you save and publish it.', confirmLabel: item ? 'Edit Happy Bite' : 'Create draft' })) return;
    setError(''); setNotice(''); setPreview(null);
    setUploads({});
    setDraft(item ? { ...item, accessType: item.accessType ?? 'free' } : { ...EMPTY_BITE });
  };

  const upload = async (kind: UploadKind, file?: File) => {
    if (!file || locked.current) return;
    const invalid = validateBiteFile(kind, file);
    if (invalid) { setError(invalid); return; }
    const replacing = Boolean(kind === 'audio' ? draft?.audioUrl : draft?.thumbnailUrl);
    if (!await confirm({ title: `${replacing ? 'Replace' : 'Upload'} ${kind === 'audio' ? 'audio' : 'thumbnail'}?`, description: `Upload “${file.name}” (${(file.size / 1024 / 1024).toFixed(1)} MB)? ${replacing ? 'The attached file will be replaced after this upload succeeds. ' : ''}Save the Happy Bite afterward to keep the change.`, confirmLabel: replacing ? 'Replace file' : 'Upload file', tone: replacing ? 'warning' : 'primary' })) return;
    if (locked.current) return;
    locked.current = true; setOperation(kind); setError(''); setNotice('');
    const controller = new AbortController();
    uploadController.current = controller;
    setUploads((current) => ({ ...current, [kind]: { name: file.name, percent: 0, phase: 'uploading' } }));
    try {
      const form = new FormData();
      form.append('scope', kind === 'thumbnail' ? 'happy-bite-thumbnail' : 'happy-bite-audio');
      // Some browsers omit MIME types. Supply the type from the validated extension.
      const extension = file.name.split('.').pop()?.toLowerCase();
      const mime = kind === 'audio' ? 'audio/mpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
      form.append('media', file.type ? file : new File([file], file.name, { type: mime }));
      const progress = (percent: number) => setUploads((current) => ({ ...current, [kind]: { name: file.name, percent, phase: percent === 100 ? 'processing' : 'uploading' } }));
      const [response, detected] = await Promise.all([
        kind === 'audio' ? (async () => {
          const ticket = await apiRequest<AudioUploadTicket>('/admin/contents/sign-happy-bite-audio', 'POST', { name: file.name, size: file.size, type: file.type }, token()).catch(error => {
            if (errorMessage(error) === 'Request failed with status 404') throw new Error('The connected backend does not support the updated audio uploader yet. Deploy the backend update, then press Retry upload.');
            throw error;
          });
          return uploadHappyBiteChunks(file, ticket, progress, controller.signal);
        })() : uploadMultipart<{ url?: string; durationSeconds?: number }>('/admin/contents/upload-media', form, token(), progress),
        kind === 'audio' ? detectAudioDuration(file) : Promise.resolve(0),
      ]);
      if (!response.url) throw new Error('The upload did not return a file URL. Please try again.');
      setDraft((current) => current ? { ...current, ...(kind === 'thumbnail'
        ? { thumbnailUrl: response.url! }
        : { audioUrl: response.url!, durationSeconds: uploadedAudioDuration(response.durationSeconds, detected) }) } : current);
      setUploads((current) => ({ ...current, [kind]: { name: file.name, percent: 100, phase: 'complete' } }));
      setNotice(`${kind === 'audio' ? 'Audio' : 'Thumbnail'} uploaded. Save your Happy Bite to keep this change.`);
      return true;
    } catch (exception) {
      setUploads((current) => ({ ...current, [kind]: { name: file.name, percent: current[kind]?.percent ?? 0, phase: 'error', error: errorMessage(exception) } }));
      setError(errorMessage(exception));
    }
    finally { locked.current = false; setOperation(''); uploadController.current = null; }
  };

  const selected = (kind: UploadKind, file?: File) => {
    setUploads(current => ({ ...current, [kind]: file ? { name: file.name, percent: 0, phase: 'selected' } : undefined }));
    setError('');
  };

  const save = async () => {
    if (!draft || locked.current) return;
    if (Object.values(uploads).some(state => state?.phase === 'selected' || state?.phase === 'error')) { setError('Upload or discard your selected files before saving.'); return; }
    const invalid = validateBiteDraft(draft);
    if (invalid) { setError(invalid); return; }
    if (!await confirm({ title: draft.published ? 'Save and publish Happy Bite?' : 'Save Happy Bite draft?', description: `Save “${draft.title}”? ${draft.published ? draft.accessType === 'premium' ? 'An active Pro subscription will be required to listen.' : 'It will be available to everyone for free.' : 'It will remain hidden from listeners.'}`, confirmLabel: draft.published ? 'Save & publish' : 'Save draft' })) return;
    if (locked.current) return;
    locked.current = true; setOperation('save'); setError(''); setNotice('');
    try {
      const { title, description, thumbnailUrl, audioUrl, durationSeconds, category, published, displayOrder, accessType } = draft;
      await apiRequest(draft._id ? `/admin/happy-bites/${encodeURIComponent(draft._id)}` : '/admin/happy-bites', draft._id ? 'PUT' : 'POST', {
        title: title.trim(), description: description.trim(), thumbnailUrl, audioUrl,
        durationSeconds, category: category.trim(), published, displayOrder, accessType,
      }, token());
      setDraft(null);
      setNotice(published ? accessType === 'premium' ? 'Premium Happy Bite saved and published for Pro members.' : 'Happy Bite saved and published. It is free for everyone.' : 'Draft saved. It stays hidden from listeners until you publish it.');
      await load();
    } catch (exception) { setError(errorMessage(exception)); }
    finally { locked.current = false; setOperation(''); }
  };

  const changeStatus = async (item: HappyBite) => {
    if (locked.current) return;
    if (!await confirm({ title: item.published ? 'Unpublish Happy Bite?' : 'Publish Happy Bite?', description: item.published ? `Hide “${item.title}” from listeners? It will remain available as a draft.` : `Publish “${item.title}”? ${item.accessType === 'premium' ? 'An active Pro subscription will be required to listen.' : 'Everyone can listen for free.'}`, confirmLabel: item.published ? 'Unpublish' : 'Publish', tone: item.published ? 'warning' : 'primary' })) return;
    if (locked.current) return;
    locked.current = true; setOperation(item._id); setError(''); setNotice('');
    try {
      await apiRequest(`/admin/happy-bites/${encodeURIComponent(item._id)}`, 'PUT', { published: !item.published }, token());
      setNotice(item.published ? 'Happy Bite unpublished. It is now hidden from listeners.' : item.accessType === 'premium' ? 'Premium Happy Bite published for Pro members.' : 'Happy Bite published. It is free for everyone.');
      await load();
    } catch (exception) { setError(errorMessage(exception)); }
    finally { locked.current = false; setOperation(''); }
  };

  const remove = async () => {
    if (!deleteItem || locked.current) return;
    locked.current = true; setOperation('delete'); setError('');
    try {
      await apiRequest(`/admin/happy-bites/${encodeURIComponent(deleteItem._id)}`, 'DELETE', undefined, token());
      setDeleteItem(null); setPreview(null);
      setNotice('Happy Bite deleted.'); await load();
    } catch (exception) { setError(errorMessage(exception)); }
    finally { locked.current = false; setOperation(''); }
  };

  return <section className="w-full min-w-0 space-y-6 text-white">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Content management</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Happy Bites</h1>
        <p className="mt-2 text-sm text-zinc-400">Small thoughts. Meaningful changes. Free and Pro listening.</p></div>
      {!draft ? <AdminButton disabled={busy} onClick={() => openEditor()} className={primaryClass}>＋ New Happy Bite</AdminButton> : null}
    </header>

    {error && !deleteItem ? <div role="alert" className="rounded-2xl border border-red-400/25 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
    {notice ? <div role="status" className="rounded-2xl border border-emerald-400/20 bg-emerald-950/25 p-4 text-sm text-emerald-200">{notice}</div> : null}

    {draft ? <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <AdminFieldset disabled={busy} className="min-w-0 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card as="div" shadow="none" className="min-w-0 space-y-6 rounded-none border-0 bg-transparent shadow-none">
            <div><h2 className="text-xl font-semibold">{draft._id ? 'Edit Happy Bite' : 'Create a Happy Bite'}</h2><p className="mt-1 text-sm text-zinc-500">Add a little inspiration to someone’s day.</p></div>
            <label className="block text-sm font-medium">Title <span className="text-orange-300">*</span><AdminInput required autoFocus className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={160} placeholder="A small step toward a calmer day" /></label>
            <label className="block text-sm font-medium">Short description <span className="text-orange-300">*</span><AdminTextarea required className={`${inputClass} min-h-28 resize-y`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={2000} placeholder="What will listeners take away from this bite?" /><span className="mt-1 block text-right text-xs text-zinc-500">{draft.description.length}/2000</span></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Category <span className="text-orange-300">*</span><AdminInput required className={inputClass} list="bite-categories" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} maxLength={80} /><datalist id="bite-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist><span className="mt-2 block text-xs text-zinc-500">Choose a category or enter a new one.</span></label>
              <label className="block text-sm font-medium">Display order<AdminInput required className={inputClass} type="number" min="0" step="1" value={Number.isFinite(draft.displayOrder) ? draft.displayOrder : ''} onChange={(e) => setDraft({ ...draft, displayOrder: e.target.valueAsNumber })} /><span className="mt-2 block text-xs text-zinc-500">Lower numbers appear first. Newest breaks ties.</span></label>
            </div>
            <div className="border-t border-white/10 pt-5">
              <HappyBiteUpload kind="audio" url={draft.audioUrl} title={draft.title} durationSeconds={draft.durationSeconds} disabled={busy} state={uploads.audio} onSelect={file => selected('audio', file)} onUpload={file => upload('audio', file)} />
              <label className="mt-4 block text-sm font-medium">Duration in seconds<AdminInput className={inputClass} type="number" min="0" step="1" value={Number.isFinite(draft.durationSeconds) ? draft.durationSeconds : ''} onChange={(e) => setDraft({ ...draft, durationSeconds: e.target.valueAsNumber })} /><span className="mt-2 block text-xs text-zinc-500">Detected automatically when possible. You can correct it here.</span></label>
            </div>
          </Card>
          <div className="min-w-0 space-y-5">
            <HappyBiteUpload kind="thumbnail" url={draft.thumbnailUrl} title={draft.title} disabled={busy} state={uploads.thumbnail} onSelect={file => selected('thumbnail', file)} onUpload={file => upload('thumbnail', file)} />
            <Card as="div" shadow="none" className="gap-3 rounded-3xl border border-divider bg-content1 p-5">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Listening access</h3><p className="mt-1 text-xs text-default-400">{draft.accessType === 'premium' ? 'Premium · Pro members' : 'Free · Everyone'}</p></div>
                <Switch aria-label="Require a Pro subscription for this Happy Bite" color="primary" isSelected={draft.accessType === 'premium'} isDisabled={busy} onValueChange={(premium) => setDraft({ ...draft, accessType: premium ? 'premium' : 'free' })} />
              </div>
              <p className="text-xs leading-5 text-default-400">{draft.accessType === 'premium' ? 'Included with the existing Pro subscription. No separate purchase.' : 'Anyone can listen without a subscription. Turn on Premium to require Pro.'}</p>
            </Card>
            <Card as="div" shadow="none" className="rounded-3xl border border-divider bg-content1 p-5">
              <div className="block text-sm font-semibold">
                <AdminSelect label="Publish status" className={inputClass} value={draft.published ? 'published' : 'draft'} onChange={(event) => setDraft({ ...draft, published: event.target.value === 'published' })}><option value="draft">Draft</option><option value="published">Published</option></AdminSelect></div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">{draft.published ? draft.accessType === 'premium' ? 'Listed in the library after saving. Only Pro members can listen.' : 'Visible to everyone after saving. No purchase or subscription required.' : 'Only admins can see drafts. Publish whenever your bite is ready.'}</p>
            </Card>
          </div>
        </div>
        <div className="flex flex-wrap gap-3"><AdminButton type="submit" className={primaryClass}>{operation === 'save' ? 'Saving…' : draft.published ? 'Save & publish' : 'Save draft'}</AdminButton><AdminButton type="button" onClick={async () => { if (!await confirm({ title: 'Discard unsaved changes?', description: 'Leave the Happy Bite editor without saving these changes?', confirmLabel: 'Discard changes', tone: 'danger' })) return; setDraft(null); setError(''); setNotice(''); }} className={buttonClass}>Cancel</AdminButton></div>
      </AdminFieldset>
    </form> : <>
      <div className="grid grid-cols-3 gap-3" aria-busy={loading}>{[['Total bites', items.length], ['Published', items.filter((item) => item.published).length], ['Drafts', items.filter((item) => !item.published).length]].map(([label, value]) => <Card as="div" shadow="none" key={label} className="rounded-2xl border border-divider bg-content1 p-4"><p className="text-xs text-zinc-400">{label}</p>{loading ? <Skeleton aria-hidden="true" className="happy-bites-skeleton mt-2 h-8 w-12 rounded-lg motion-reduce:before:animate-none" /> : <p className="mt-2 text-2xl font-semibold">{value}</p>}</Card>)}</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1 text-xs text-zinc-400">Search<AdminInput className={inputClass} type="search" placeholder="Search Happy Bites…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="text-xs text-zinc-400">
          <AdminSelect label="Status" className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Drafts</option></AdminSelect></div>
        <div className="text-xs text-zinc-400">
          <AdminSelect label="Category" className={inputClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All categories</option>{[...new Set(items.map((item) => item.category))].sort().map((category) => <option key={category}>{category}</option>)}</AdminSelect></div>
        <AdminButton disabled={loading || busy} onClick={() => void load()} className={buttonClass}>Refresh</AdminButton>
      </div>
      <Card as="div" shadow="none" aria-busy={loading} className="w-full rounded-none border-0 bg-transparent shadow-none">
        {loading ? <HappyBitesSkeleton /> : visibleItems.length === 0 ? <div className="px-5 py-12 text-center"><p className="text-lg font-semibold">{items.length ? 'No matching Happy Bites' : error ? 'Library unavailable' : 'Make someone’s day a little brighter'}</p><p className="mt-2 text-sm text-zinc-400">{items.length ? 'Try a different search or filter.' : error ? 'Check the message above, then refresh to try again.' : 'Upload your first short audio and share it for free.'}</p></div> : visibleItems.map((item) => <article key={item._id} className="border-b border-white/10 py-5 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4"><Thumbnail key={item.thumbnailUrl} src={item.thumbnailUrl} title={item.title} /><div className="min-w-0"><h2 className="truncate font-semibold">{item.title}</h2><p className="mt-1 text-xs text-zinc-400">{item.category} · {formatBiteDuration(item.durationSeconds)}</p><p className="mt-1 text-xs text-zinc-500">Order {item.displayOrder} · Updated {dateLabel(item.updatedAt)}</p></div></div>
            <div className="flex flex-wrap gap-2"><Chip size="sm" variant="flat" color={item.accessType === "premium" ? "warning" : "default"}>{item.accessType === "premium" ? "Premium" : "Free"}</Chip><Chip size="sm" variant="flat" color={item.published ? 'success' : 'default'}>{item.published ? 'Published' : 'Draft'}</Chip></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton className={buttonClass} onClick={() => setPreview(preview === item._id ? null : item._id)}>{preview === item._id ? 'Close preview' : 'Listen'}</AdminButton>
            <AdminButton disabled={busy} className={buttonClass} onClick={() => openEditor(item)}>Edit</AdminButton>
            <AdminButton disabled={busy} className={buttonClass} onClick={() => void changeStatus(item)}>{operation === item._id ? 'Updating…' : item.published ? 'Unpublish' : 'Publish'}</AdminButton>
            <AdminButton disabled={busy} className={`${buttonClass} text-red-300`} onClick={() => { setError(''); setDeleteItem(item); }}>Delete</AdminButton>
          </div>
          {preview === item._id ? <div className="mt-4 space-y-3 rounded-2xl bg-white/5 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{item.description}</p><AudioPreview src={item.audioUrl} title={item.title} durationSeconds={item.durationSeconds} /><p className="break-all text-xs text-zinc-500">ID {item._id} · Created {dateLabel(item.createdAt)}</p></div> : null}
        </article>)}
      </Card>
    </>}

    <AdminModal isOpen={Boolean(deleteItem)} onClose={() => setDeleteItem(null)} isDismissable={false} isKeyboardDismissDisabled={busy} hideCloseButton={busy} backdrop="blur" classNames={{ base: 'dark admin-ui bg-content1 text-foreground border border-divider' }}>
      <ModalContent><ModalHeader id="delete-bite-title">Delete this Happy Bite?</ModalHeader><ModalBody>
      <p className="mt-3 text-sm leading-6 text-zinc-400">“{deleteItem?.title}” will be removed from the library. This cannot be undone. You can unpublish it instead to keep a draft.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
      </ModalBody><ModalFooter><AdminButton autoFocus disabled={busy} onClick={() => setDeleteItem(null)} className={buttonClass}>Keep it</AdminButton><AdminButton disabled={busy} onClick={() => void remove()} className={`${buttonClass} border-red-400/30 bg-red-500/15 text-red-200`}>{operation === 'delete' ? 'Deleting…' : 'Delete Happy Bite'}</AdminButton></ModalFooter></ModalContent>
    </AdminModal>
  </section>;
}
