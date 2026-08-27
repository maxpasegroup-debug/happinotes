// @ts-nocheck
"use client";

import { motion } from "framer-motion";
import type { LifebookItem } from "@/lib/content-api";
import type { SeriesItem } from "./types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

export function SeriesCarousel({
  series,
  onListen,
}: {
  series: SeriesItem[];
  onListen: (item: LifebookItem) => void;
}) {
  if (series.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-white">Series Collections</h3>
      <div className="space-y-4">
        {series.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="text-sm font-medium text-[#B0B0B0]">{group.title}</p>
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {group.items.map((item, index) => (
                <motion.button
                  key={item._id}
                  type="button"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onListen(item)}
                  className="w-[180px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#1F1F2E] text-left"
                >
                  <img
                    src={item.thumbnailUrl || FALLBACK_IMAGE}
                    alt={item.title}
                    width={180}
                    height={240}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="space-y-1 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#B0B0B0]">Part {index + 1}</p>
                    <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-[#FFC107]">Listen now</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
