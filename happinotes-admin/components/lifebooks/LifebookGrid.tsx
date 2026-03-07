"use client";

import type { LifebookItem } from "@/lib/content-api";
import { LifebookCard } from "./LifebookCard";
import type { LifebookActionHandlers } from "./types";

export function LifebookGrid({
  items,
  onListen,
  onToggleFavourite,
  isFavourite,
  mobileFirstButtons = false,
}: { items: LifebookItem[]; mobileFirstButtons?: boolean } & LifebookActionHandlers) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold text-white">All Lifebooks</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <LifebookCard
            key={item._id}
            item={item}
            isFavourite={isFavourite(item._id)}
            onToggleFavourite={() => onToggleFavourite(item)}
            onListen={() => onListen(item)}
            fullWidthButton={mobileFirstButtons}
          />
        ))}
      </div>
    </section>
  );
}
