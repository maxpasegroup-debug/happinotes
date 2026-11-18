"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Skeleton, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Pagination } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";
import { AdminButton, AdminInput } from "@/components/admin/ui";
import { apiRequest, BASE_URL } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  contentType: "lifebook" | "note" | "silence";
  featured?: boolean;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  createdAt?: string;
};
const FEATURED_PER_PAGE = 6;

function Icon({ name, className = "h-5 w-5" }: { name: "star" | "book" | "search" | "refresh" | "plus"; className?: string }) {
  const paths = {
    star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",
    book: "M12 5v15M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z",
    search: "m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    refresh: "M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9",
    plus: "M12 5v14M5 12h14",
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function typeLabel(type: Content["contentType"]) {
  return type === "silence" ? "Happiness" : type === "lifebook" ? "Lifebook" : "Note";
}

function Cover({ item, compact = false }: { item: Content; compact?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = item.thumbnailUrl || item.coverImageUrl;
  const src = source?.startsWith("//") ? `https:${source}` : source?.startsWith("/") ? `${BASE_URL}${source}` : source?.startsWith("uploads/") ? `${BASE_URL}/${source}` : source;
  return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-gradient-to-br from-orange-400/15 to-slate-800 text-orange-300/70 shadow-sm ${compact ? 'h-12 w-9 rounded-md' : 'h-24 w-18 rounded-xl'}`}>
    {src && failedSource !== src ? <Image unoptimized fill sizes={compact ? "36px" : "72px"} src={src} alt={item.title} className="object-cover" onError={() => setFailedSource(src)} /> : <Icon name="book" className={compact ? 'h-5 w-5' : 'h-7 w-7'} />}
  </div>;
}

function FeaturedSkeleton() {
  const columns = ['Priority', 'Content', 'Type', 'Featured', 'Created', 'Actions'];
  return <div role="status" aria-label="Loading featured content" aria-busy="true" className="space-y-8">
    <span className="sr-only">Loading featured content…</span>
    <div aria-hidden="true" className="space-y-8">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">{[0, 1, 2].map(i => <div key={i} className="rounded-2xl border border-white/10 bg-content1 px-4 py-4 sm:px-5"><Skeleton className="h-8 w-12 rounded-lg motion-reduce:before:animate-none" /><Skeleton className="mt-2 h-3 w-20 rounded motion-reduce:before:animate-none" /></div>)}</div>
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><Skeleton className="h-5 w-40 rounded-lg motion-reduce:before:animate-none" /><Skeleton className="h-3 w-72 max-w-full rounded motion-reduce:before:animate-none" /></div><Skeleton className="h-10 w-full rounded-xl sm:w-64 motion-reduce:before:animate-none" /></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-content1"><div className="overflow-x-auto"><Table aria-label="Loading featured content table" removeWrapper className="min-w-[900px]" classNames={{ table: 'w-full', th: 'h-12 bg-content2 px-4 first:pl-5 last:pr-5', td: 'border-b border-divider/60 px-4 py-4 first:pl-5 last:pr-5 last:border-0' }}><TableHeader>{columns.map(column => <TableColumn key={column}><Skeleton className="h-3 w-20 rounded motion-reduce:before:animate-none" /></TableColumn>)}</TableHeader><TableBody>{[0, 1, 2, 3, 4, 5].map(row => <TableRow key={row}><TableCell><Skeleton className="h-4 w-5 rounded motion-reduce:before:animate-none" /></TableCell><TableCell><div className="flex min-w-[280px] items-center gap-3"><Skeleton className="h-12 w-9 shrink-0 rounded-md motion-reduce:before:animate-none" /><div className="space-y-2"><Skeleton className="h-3.5 w-44 rounded motion-reduce:before:animate-none" /><Skeleton className="h-2.5 w-24 rounded motion-reduce:before:animate-none" /></div></div></TableCell><TableCell><Skeleton className="h-3 w-16 rounded motion-reduce:before:animate-none" /></TableCell><TableCell><Skeleton className="h-6 w-20 rounded-full motion-reduce:before:animate-none" /></TableCell><TableCell><Skeleton className="h-3 w-20 rounded motion-reduce:before:animate-none" /></TableCell><TableCell><div className="flex justify-end gap-2"><Skeleton className="h-8 w-14 rounded-lg motion-reduce:before:animate-none" /><Skeleton className="h-8 w-20 rounded-lg motion-reduce:before:animate-none" /></div></TableCell></TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between border-t border-divider px-5 py-3"><Skeleton className="h-3 w-48 rounded motion-reduce:before:animate-none" /><Skeleton className="h-8 w-28 rounded-lg motion-reduce:before:animate-none" /></div></div>
      </section>
    </div>
  </div>;
}

export default function FeaturedPage() {
  const confirm = useAdminConfirmation();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError("");
    try {
      const token = window.localStorage.getItem("admin_token") || "";
      const res = await apiRequest<{ contents: Content[] }>("/admin/contents", "GET", undefined, token);
      if (isActive()) setItems(res.contents || []);
    } catch (failure) {
      if (isActive()) setError(failure instanceof Error ? failure.message : "Could not load featured content");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]);

  async function toggle(item: Content) {
    if (pending || loading) return;
    setPending(item._id);
    try {
      if (!await confirm({ title: item.featured ? "Remove from featured?" : "Feature content?", description: `${item.featured ? "Remove" : "Add"} “${item.title}” ${item.featured ? "from" : "to"} the featured selection?`, confirmLabel: item.featured ? "Unfeature" : "Feature content" })) return;
      setError("");
      const token = window.localStorage.getItem("admin_token") || "";
      await apiRequest(`/admin/contents/${item._id}/${item.featured ? "unfeature" : "feature"}`, "PATCH", undefined, token);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update featured content. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function edit(item: Content) {
    if (await confirm({ title: "Edit content?", description: `Open “${item.title}” for editing?`, confirmLabel: "Edit content" })) router.push(`/admin/content/${item._id}/edit`);
  }

  const featured = useMemo(() => items.filter(x => x.featured).sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")), [items]);
  const unfeatured = useMemo(() => items.filter(x => !x.featured), [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items].filter(item => !query || `${item.title} ${typeLabel(item.contentType)}`.toLowerCase().includes(query)).sort((a, b) => {
      if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
      return a.featured ? Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "") : a.title.localeCompare(b.title);
    });
  }, [items, search]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / FEATURED_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * FEATURED_PER_PAGE;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + FEATURED_PER_PAGE);
  useEffect(() => { setPage(1); }, [search]);
  const busy = loading || pending !== null;

  return <section className="w-full min-w-0 space-y-7" aria-busy={loading}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Content management</p><h1>Featured content</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Featured items are shown first on landing. Priority is top-to-bottom order.</p></div>
      <AdminButton variant="bordered" isLoading={loading} disabled={busy} startContent={!loading ? <Icon name="refresh" className="h-4 w-4" /> : undefined} onPress={() => void load()}>Refresh</AdminButton>
    </header>
    {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger"><p>{error}</p><AdminButton onPress={() => void load()} disabled={busy}>Try again</AdminButton></div> : null}
    {loading && items.length === 0 ? <FeaturedSkeleton /> : (!error || items.length > 0) ? <motion.div initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-8">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[{ label: "Featured", value: featured.length, accent: true }, { label: "Available", value: unfeatured.length }, { label: "Total library", value: items.length }].map(stat => <div key={stat.label} className={`min-w-0 rounded-2xl border px-4 py-4 sm:px-5 ${stat.accent ? "border-orange-400/20 bg-orange-400/[.07]" : "border-white/10 bg-content1"}`}><p className={`text-2xl font-semibold tabular-nums sm:text-3xl ${stat.accent ? "text-orange-300" : "text-slate-100"}`}>{stat.value}</p><p className="mt-1 text-xs text-slate-400 sm:text-sm">{stat.label}</p></div>)}
      </div>
      <section aria-labelledby="featured-selection-title" className="min-w-0 space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="featured-selection-title" className="text-lg font-semibold text-slate-100">Featured library <span className="ml-1 text-sm font-normal text-slate-500">{items.length}</span></h2><p className="mt-1 text-sm text-slate-400">Featured rows stay at the top; priority is shown top-to-bottom.</p></div><AdminInput aria-label="Search featured content" placeholder="Search title or type…" value={search} onChange={event => setSearch(event.target.value)} startContent={<Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />} className="w-full sm:max-w-xs" /></div>
        {filteredItems.length ? <div className="overflow-hidden rounded-2xl border border-white/10 bg-content1"><div className="overflow-x-auto"><Table aria-label="Featured content library" removeWrapper className="min-w-[900px]" classNames={{ table: "w-full", th: "h-12 bg-content2 px-4 text-[10px] font-bold uppercase tracking-[.12em] text-default-400 first:pl-5 last:pr-5", td: "border-b border-divider/60 px-4 py-3 first:pl-5 last:pr-5 last:border-0" }}><TableHeader><TableColumn>Priority</TableColumn><TableColumn>Content</TableColumn><TableColumn>Type</TableColumn><TableColumn>Featured</TableColumn><TableColumn>Created</TableColumn><TableColumn align="end">Actions</TableColumn></TableHeader><TableBody>{paginatedItems.map((item) => { const priority = item.featured ? featured.findIndex(entry => entry._id === item._id) + 1 : null; return <TableRow key={item._id} className="group hover:bg-content2/40"><TableCell><span className={`font-semibold tabular-nums ${priority === 1 ? 'text-orange-300' : 'text-default-500'}`}>{priority ? String(priority).padStart(2, '0') : '—'}</span></TableCell><TableCell><div className="flex min-w-[280px] items-center gap-3"><Cover item={item} compact /><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground" title={item.title}>{item.title}</p><p className="mt-1 text-[11px] text-default-400">{priority === 1 ? 'First on landing' : priority ? `Priority ${priority}` : 'Available to feature'}</p></div></div></TableCell><TableCell><span className="text-sm text-default-600">{typeLabel(item.contentType)}</span></TableCell><TableCell>{item.featured ? <Chip size="sm" color="warning" variant="flat">Featured</Chip> : <Chip size="sm" color="default" variant="flat">Available</Chip>}</TableCell><TableCell><span className="whitespace-nowrap text-xs text-default-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="light" className="min-h-9 text-default-600" isDisabled={busy} onPress={() => void edit(item)} aria-label={`Edit ${item.title}`}>Edit</Button><AdminButton color={item.featured ? 'default' : 'primary'} variant={item.featured ? 'bordered' : 'flat'} isLoading={pending === item._id} disabled={busy} onPress={() => void toggle(item)} aria-label={`${item.featured ? 'Unfeature' : 'Feature'} ${item.title}`}>{item.featured ? 'Unfeature' : 'Feature'}</AdminButton></div></TableCell></TableRow>; })}</TableBody></Table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-3"><p className="text-xs text-default-400">Showing {pageStart + 1}–{Math.min(pageStart + FEATURED_PER_PAGE, filteredItems.length)} of {filteredItems.length} content items · {featured.length} currently featured</p>{pageCount > 1 ? <Pagination aria-label="Featured content pagination" page={currentPage} total={pageCount} onChange={setPage} showControls isCompact size="sm" radius="lg" color="primary" siblings={0} boundaries={1} /> : null}</div></div> : <div className="rounded-2xl border border-dashed border-white/15 bg-content1/50 p-8 text-center"><Icon name={search.trim() ? "search" : "book"} className="mx-auto mb-3 h-7 w-7 text-slate-500" /><p className="text-sm text-slate-400">{search.trim() ? "No content matches your search." : "No content available to feature."}</p>{search.trim() ? <AdminButton className="mt-4" variant="light" onClick={() => setSearch("")}>Clear search</AdminButton> : null}</div>}
      </section>
    </motion.div> : null}
  </section>;
}
