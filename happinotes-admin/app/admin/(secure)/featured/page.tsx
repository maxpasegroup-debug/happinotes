"use client";

import Image from "next/image";

import { useAdminConfirmation } from "@/components/admin/ConfirmationProvider";

import { AdminButton } from "@/components/admin/ui";

import { Card, CardBody, Chip, Button, Skeleton } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Content = {
  _id: string;
  title: string;
  contentType: "lifebook" | "note" | "silence";
  featured?: boolean;
  thumbnailUrl?: string;
  createdAt?: string;
};

function FeaturedSkeleton() {
  return <div role="status" aria-label="Loading featured content" className="space-y-8">
    <span className="sr-only">Loading featured content…</span>
    <div aria-hidden="true" className="space-y-8">
      {[0, 1].map((section) => <div key={section} className="space-y-4">
        <div className="flex items-center gap-3"><Skeleton className="h-6 w-24 rounded-lg motion-reduce:before:animate-none" /><Skeleton className="h-6 w-8 rounded-full motion-reduce:before:animate-none" /></div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2].map((card) => <Card key={card} shadow="sm" className="border border-divider bg-content1">
            <Skeleton className="aspect-[4/3] w-full rounded-none motion-reduce:before:animate-none" />
            <CardBody className="gap-4 p-5">
              <div className="space-y-2"><Skeleton className="h-5 w-4/5 rounded-md motion-reduce:before:animate-none" /><Skeleton className="h-3 w-20 rounded-md motion-reduce:before:animate-none" /></div>
              {section === 0 ? <Skeleton className="h-6 w-24 rounded-full motion-reduce:before:animate-none" /> : null}
              <div className="flex gap-2"><Skeleton className="h-10 w-24 rounded-xl motion-reduce:before:animate-none" /><Skeleton className="h-10 w-16 rounded-xl motion-reduce:before:animate-none" /></div>
            </CardBody>
          </Card>)}
        </div>
      </div>)}
    </div>
  </div>;
}

export default function FeaturedPage() {
  const confirm = useAdminConfirmation();
  const router = useRouter();
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return () => {
      active = false;
    };
  }, [load]);

  async function toggle(item: Content) {
    if (!await confirm({ title: item.featured ? 'Remove from featured?' : 'Feature content?', description: `${item.featured ? 'Remove' : 'Add'} “${item.title}” ${item.featured ? 'from' : 'to'} the featured selection?`, confirmLabel: item.featured ? 'Unfeature' : 'Feature content' })) return;
    const token = window.localStorage.getItem("admin_token") || "";
    await apiRequest(`/admin/contents/${item._id}/${item.featured ? "unfeature" : "feature"}`, "PATCH", undefined, token);
    await load();
  }

  const featured = useMemo(
    () => items.filter((x) => x.featured).sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "")),
    [items]
  );
  const unfeatured = useMemo(() => items.filter((x) => !x.featured), [items]);
  const sections: Array<{ label: "Featured" | "Available"; list: Content[] }> = [
    { label: "Featured", list: featured },
    { label: "Available", list: unfeatured },
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-8" aria-busy={loading}>
      <header><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">Content management</p><h1>Featured content</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-default-400">Featured items are shown first on landing. Priority is top-to-bottom order.</p></header>
      {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger"><p>{error}</p><AdminButton onClick={() => void load()} disabled={loading}>Try again</AdminButton></div> : null}
      {loading && items.length === 0 ? <FeaturedSkeleton /> : (!error || items.length > 0) ? sections.map(({ label, list }) => <section key={label} className="space-y-4">
        <div className="flex items-center gap-3"><h2>{label}</h2><Chip size="sm" variant="flat">{list.length}</Chip></div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((item, index) => <Card key={item._id} shadow="sm" className="border border-divider bg-content1">
            {item.thumbnailUrl ? <Image unoptimized width={400} height={300} src={item.thumbnailUrl} alt={item.title} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-content2 text-4xl text-default-300" aria-label="No cover image">♪</div>}
            <CardBody className="gap-4 p-5">
              <div><h3 className="line-clamp-2 font-semibold">{item.title}</h3><p className="mt-1 text-xs capitalize text-default-400">{item.contentType === "silence" ? "Happiness" : item.contentType}</p></div>
              {label === "Featured" ? <Chip size="sm" color="primary" variant="flat">Priority #{index + 1}</Chip> : null}
              <div className="mt-auto flex flex-wrap gap-2"><AdminButton onClick={() => toggle(item)} color={item.featured ? 'default' : 'primary'}>{item.featured ? "Unfeature" : "Feature"}</AdminButton><Button type="button" onPress={async () => { if (await confirm({ title: 'Edit content?', description: `Open “${item.title}” for editing?`, confirmLabel: 'Edit content' })) router.push(`/admin/content/${item._id}/edit`); }} size="sm" variant="light" className="min-h-10">Edit</Button></div>
            </CardBody>
          </Card>)}
        </div>
        {!list.length ? <Card shadow="none" className="border border-dashed border-divider bg-content1/50"><CardBody className="p-10 text-center text-sm text-default-400">{label === 'Featured' ? 'No featured content yet. Feature an available item below.' : 'No available content to feature.'}</CardBody></Card> : null}
      </section>) : null}
    </section>
  );
}
