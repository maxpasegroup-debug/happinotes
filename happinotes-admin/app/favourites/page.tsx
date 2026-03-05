"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { BASE_URL } from "@/lib/content-api";
import { getStoredUser, getUserToken } from "@/lib/user-session";

type FavContent = {
  _id: string;
  id?: string;
  title: string;
  thumbnailUrl?: string;
  type?: "free" | "premium";
  contentType?: "lifebook" | "note" | "silence";
  lessons?: { title?: string }[];
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

export default function FavouritesPage() {
  const [items, setItems] = useState<FavContent[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useMemo(() => getStoredUser(), []);

  useEffect(() => {
    const token = getUserToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${BASE_URL}/favourites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : { favourites: [] }))
      .then((data) => {
        const favs = (data?.favourites || []) as FavContent[];
        setItems(favs.filter((x) => x.contentType === "lifebook"));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <section>
        <h1 className="text-2xl font-semibold text-white">Favourites</h1>
        <p className="mt-1 text-sm text-[#b7c0d8]">Your saved Lifebooks</p>
      </section>

      {!user ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#141a2a] p-5">
          <p className="text-sm text-[#b7c0d8]">Please sign up or login from Lifebooks to use favourites.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-[#f6c453]">Go to Lifebooks</Link>
        </div>
      ) : loading ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#141a2a] p-5 text-sm text-[#b7c0d8]">Loading...</div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#141a2a] p-5 text-sm text-[#b7c0d8]">
          No favourites yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item._id}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141a2a] p-3"
            >
              <img
                src={item.thumbnailUrl || FALLBACK_IMAGE}
                alt={item.title}
                className="h-16 w-14 rounded-lg object-cover"
                loading="lazy"
              />
              <div className="flex-1">
                <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-[#b7c0d8]">{item.lessons?.length || 5} Lessons</p>
              </div>
              <Link
                href={`/player/${item.id || item._id}`}
                className="rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-3 py-1 text-xs font-semibold text-[#211100]"
              >
                Play
              </Link>
            </div>
          ))}
        </div>
      )}
    </MobileShell>
  );
}
