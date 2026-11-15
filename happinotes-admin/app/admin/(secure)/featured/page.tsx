"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Skeleton } from "@heroui/react";
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

function Cover({ item }: { item: Content }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = item.thumbnailUrl || item.coverImageUrl;
  const src = source?.startsWith("//") ? `https:${source}` : source?.startsWith("/") ? `${BASE_URL}${source}` : source?.startsWith("uploads/") ? `${BASE_URL}/${source}` : source;
  return <div className="relative flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-orange-400/15 to-slate-800 text-orange-300/70 shadow-sm">
    {src && failedSource !== src ? <Image unoptimized fill sizes="72px" src={src} alt={item.title} className="object-cover" onError={() => setFailedSource(src)} /> : <Icon name="book" className="h-7 w-7" />}
  </div>;
}

function FeaturedSkeleton() {
  return <div role="status" aria-label="Loading featured content" className="space-y-8">
    <span className="sr-only">Loading featured content…</span>
    <div aria-hidden="true" className="space-y-8">
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl motion-reduce:before:animate-none" />)}</div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-content1 p-5 sm:p-6">
        <Skeleton className="mb-6 h-6 w-44 rounded-lg motion-reduce:before:animate-none" />
        {[0, 1, 2].map(i => <div key={i} className="flex items-center gap-4 border-t border-white/5 py-5"><Skeleton className="h-5 w-6 shrink-0 rounded-md motion-reduce:before:animate-none" /><Skeleton className="h-24 w-18 shrink-0 rounded-xl motion-reduce:before:animate-none" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-3/4 max-w-sm rounded-md motion-reduce:before:animate-none" /><Skeleton className="h-3 w-20 rounded-md motion-reduce:before:animate-none" /></div></div>)}
      </div>
      <Skeleton className="h-6 w-44 rounded-lg motion-reduce:before:animate-none" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-44 rounded-2xl motion-reduce:before:animate-none" />)}</div>
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
  const available = useMemo(() => unfeatured.filter(item => `${item.title} ${typeLabel(item.contentType)}`.toLowerCase().includes(search.trim().toLowerCase())), [unfeatured, search]);
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
      <section aria-labelledby="featured-selection-title" className="overflow-hidden rounded-2xl border border-white/10 bg-content1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-orange-400/[.08] to-transparent p-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/10 text-orange-300"><Icon name="star" /></span><div><h2 id="featured-selection-title" className="text-base font-semibold text-slate-100">Featured selection</h2><p className="mt-1 text-xs text-slate-400">Your landing page highlights</p></div></div>
          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-300">{featured.length} featured</span>
        </div>
        {featured.length ? <ol aria-label="Featured content priority" className="divide-y divide-white/[.06]">
          {featured.map((item, index) => <li key={item._id} className="group flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-white/[.025] sm:gap-5 sm:px-6 sm:py-5">
            <span aria-label={`Priority ${index + 1}`} className={`w-6 shrink-0 text-sm font-semibold tabular-nums sm:w-8 sm:text-lg ${index === 0 ? "text-orange-300" : "text-slate-500"}`}>{String(index + 1).padStart(2, "0")}</span>
            <Cover item={item} />
            <div className="min-w-0 flex-1"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">{index === 0 ? "First on landing" : `Priority ${index + 1}`}</p><h3 className="break-words text-sm font-semibold leading-6 text-slate-100 sm:text-base">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{typeLabel(item.contentType)}</p></div>
            <div className="flex w-full justify-end gap-2 sm:w-auto"><Button size="sm" variant="light" className="min-h-10 text-slate-300" isDisabled={busy} onPress={() => void edit(item)} aria-label={`Edit ${item.title}`}>Edit</Button><AdminButton variant="bordered" isLoading={pending === item._id} disabled={busy} onPress={() => void toggle(item)} aria-label={`Unfeature ${item.title}`}>Unfeature</AdminButton></div>
          </li>)}
        </ol> : <div className="flex flex-col items-center px-6 py-12 text-center"><Icon name="star" className="mb-4 h-9 w-9 text-orange-300/60" /><h3 className="font-semibold text-slate-200">Give your best content the spotlight</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">No featured content yet. Feature an available item below.</p></div>}
      </section>
      <section aria-labelledby="available-content-title" className="min-w-0 space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="available-content-title" className="text-lg font-semibold text-slate-100">Available library <span className="ml-1 text-sm font-normal text-slate-500">{unfeatured.length}</span></h2><p className="mt-1 text-sm text-slate-400">Choose what deserves a place in your featured selection.</p></div><AdminInput aria-label="Search available content" placeholder="Search title or type…" value={search} onChange={event => setSearch(event.target.value)} startContent={<Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />} className="w-full sm:max-w-xs" /></div>
        {available.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{available.map(item => <article key={item._id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-content1 p-4 transition-colors hover:border-orange-400/25 sm:p-5">
          <div className="flex items-center gap-4"><Cover item={item} /><div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{typeLabel(item.contentType)}</span><h3 className="mt-2 break-words text-sm font-semibold leading-6 text-slate-100">{item.title}</h3></div></div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[.06] pt-3"><Button size="sm" variant="light" className="min-h-10 text-slate-300" isDisabled={busy} onPress={() => void edit(item)} aria-label={`Edit ${item.title}`}>Edit content</Button><AdminButton color="primary" variant="flat" startContent={<Icon name="plus" className="h-4 w-4" />} isLoading={pending === item._id} disabled={busy} onPress={() => void toggle(item)} aria-label={`Feature ${item.title}`}>Feature</AdminButton></div>
        </article>)}</div> : <div className="rounded-2xl border border-dashed border-white/15 bg-content1/50 p-8 text-center"><Icon name={search.trim() ? "search" : "book"} className="mx-auto mb-3 h-7 w-7 text-slate-500" /><p className="text-sm text-slate-400">{search.trim() ? "No content matches your search." : "No available content to feature."}</p>{search.trim() ? <AdminButton className="mt-4" variant="light" onPress={() => setSearch("")}>Clear search</AdminButton> : null}</div>}
      </section>
    </motion.div> : null}
  </section>;
}
