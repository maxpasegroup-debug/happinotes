// @ts-nocheck
"use client";

import type { LifebookItem } from "@/lib/content-api";
import { LifebookCard } from "./LifebookCard";
import type { LifebookActionHandlers } from "./types";

export function TrendingCarousel({
  items,
  onListen,
  onToggleFavourite,
  isFavourite,
}: { items: LifebookItem[] } & LifebookActionHandlers) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Trending Lifebooks</h3>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
        {items.map((item) => (
          <div key={item._id} className="w-[235px] shrink-0 snap-start">
            <LifebookCard
              item={item}
              isFavourite={isFavourite(item._id)}
              onToggleFavourite={() => onToggleFavourite(item)}
              onListen={() => onListen(item)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
