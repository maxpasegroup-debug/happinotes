"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { LifebookItem } from "@/lib/content-api";
import { HeroLifebook } from "./HeroLifebook";
import { ContinueListening } from "./ContinueListening";
import { TrendingCarousel } from "./TrendingCarousel";
import { SeriesCarousel } from "./SeriesCarousel";
import { LifebookGrid } from "./LifebookGrid";
import type { ContinueListeningItem, SeriesItem } from "./types";

const PART1_REGEX = /save\s*our\s*kids.*part\s*1/i;
const PART2_REGEX = /save\s*our\s*kids.*part\s*2/i;
const PART1_COMPLETE_KEY = "web_save_our_kids_part1_completed";

function buildSeries(items: LifebookItem[]): SeriesItem[] {
  const map = new Map<string, LifebookItem[]>();
  for (const item of items) {
    const title = (item.title || "").trim();
    const seriesKey = title.replace(/\s*part\s*\d+\s*$/i, "").trim();
    if (!seriesKey || seriesKey === title) continue;
    const bucket = map.get(seriesKey) || [];
    bucket.push(item);
    map.set(seriesKey, bucket);
  }

  return [...map.entries()]
    .map(([key, value]) => ({ key, title: `${key} Series`, items: value }))
    .filter((x) => x.items.length >= 2);
}

export function LifebooksPremiumLayout({
  items,
  search,
  onSearchChange,
  onOpenFavourites,
  onOpenProfile,
  onListen,
  onPreview,
  onToggleFavourite,
  isFavourite,
  continueItem,
  onResumeContinue,
  mobileFirstButtons = false,
}: {
  items: LifebookItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFavourites: () => void;
  onOpenProfile: () => void;
  onListen: (item: LifebookItem) => void;
  onPreview: (item: LifebookItem) => void;
  onToggleFavourite: (item: LifebookItem) => void;
  isFavourite: (itemId: string) => boolean;
  continueItem: ContinueListeningItem | null;
  onResumeContinue: () => void;
  mobileFirstButtons?: boolean;
}) {
  const [part1Completed, setPart1Completed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => setPart1Completed(window.localStorage.getItem(PART1_COMPLETE_KEY) === "true");
    read();
    const onStorage = () => read();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.title.toLowerCase().includes(q));
  }, [items, search]);

  const part1Item = useMemo(
    () => items.find((item) => PART1_REGEX.test(item.title || "")) || null,
    [items]
  );
  const part2Item = useMemo(
    () => items.find((item) => PART2_REGEX.test(item.title || "")) || null,
    [items]
  );

  const prioritized = useMemo(() => {
    const next = [...filtered];
    const score = (item: LifebookItem) => {
      const title = item.title || "";
      if (part1Completed && PART2_REGEX.test(title)) return -3;
      if (PART1_REGEX.test(title)) return -2;
      return 0;
    };
    next.sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;
      return 0;
    });
    return next;
  }, [filtered, part1Completed]);

  const heroItem = prioritized[0] || part1Item || filtered[0] || items[0] || null;
  const trendingItems = prioritized.slice(0, 8);
  const series = buildSeries(filtered);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0F0F1B] to-[#1A1A2E] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src="/happinotes-logo.png" alt="Happinotes" className="h-8 w-auto object-contain" />
              <p className="text-xl font-semibold text-white">Lifebooks</p>
            </div>
            <p className="mt-1 text-sm text-[#B0B0B0]">Practical Books for Real Life</p>
          </div>

          <div className="flex w-full items-center gap-2 md:max-w-2xl">
            <div className="flex-1 rounded-xl border border-white/15 bg-[#1F1F2E] px-4 py-2.5">
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Lifebooks..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#8f99b3]"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenFavourites}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white"
              aria-label="Favourites"
            >
              ♥
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onOpenProfile}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white"
              aria-label="Profile"
            >
              ☺
            </motion.button>
          </div>
        </div>
      </section>

      <HeroLifebook item={heroItem} onListen={onListen} onPreview={onPreview} />
      <ContinueListening item={continueItem} onResume={onResumeContinue} />
      {part1Completed && part2Item ? (
        <section className="rounded-2xl border border-[#FFC107]/25 bg-[#1F1F2E] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#FFC107]">Recommended Next</p>
          <div className="mt-2 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-semibold text-white">{part2Item.title}</p>
              <p className="text-sm text-[#B0B0B0]">
                You completed Part 1. Continue your journey with Part 2.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onListen(part2Item)}
              className="rounded-xl bg-gradient-to-r from-[#FFC107] to-[#FF9800] px-4 py-2 text-sm font-semibold text-[#1b1200]"
            >
              Listen Now
            </motion.button>
          </div>
        </section>
      ) : null}
      <TrendingCarousel
        items={trendingItems}
        onListen={onListen}
        onToggleFavourite={onToggleFavourite}
        isFavourite={isFavourite}
      />
      <SeriesCarousel series={series} onListen={onListen} />
      <LifebookGrid
        items={prioritized}
        onListen={onListen}
        onToggleFavourite={onToggleFavourite}
        isFavourite={isFavourite}
        mobileFirstButtons={mobileFirstButtons}
      />
    </motion.div>
  );
}
