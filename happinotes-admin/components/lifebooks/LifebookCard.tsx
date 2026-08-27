// @ts-nocheck
"use client";

import { motion } from "framer-motion";
import type { LifebookItem } from "@/lib/content-api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

function estimateDuration(item: LifebookItem): string {
  const lessons = item.lessons?.length || 0;
  const mins = lessons > 0 ? lessons * 7 : 45;
  return `${mins} min audio`;
}

export function LifebookCard({
  item,
  isFavourite,
  onToggleFavourite,
  onListen,
  fullWidthButton = false,
}: {
  item: LifebookItem;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onListen: () => void;
  fullWidthButton?: boolean;
}) {
  const isPremium = item.type === "premium";
  const isComingSoon = item.status === "coming_soon";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#1F1F2E] shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="relative overflow-hidden bg-[#111827]">
        <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.25 }}>
          <img
            src={item.thumbnailUrl || FALLBACK_IMAGE}
            alt={item.title}
            className="aspect-[3/4] w-full object-cover"
            loading="lazy"
            onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
          />
        </motion.div>
        <button
          type="button"
          onClick={onToggleFavourite}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/35 text-lg text-white backdrop-blur"
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          {isFavourite ? "★" : "☆"}
        </button>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 text-lg font-semibold text-white">{item.title}</h3>
        <p className="line-clamp-2 text-sm text-[#B0B0B0]">
          {item.description?.trim() || "Practical insights to improve your life and decisions."}
        </p>
        <p className="text-xs font-medium text-[#cfcfcf]">{estimateDuration(item)}</p>

        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isPremium
                ? "bg-[#FFD700]/20 text-[#FFD700]"
                : "bg-[#00C853]/20 text-[#00C853]"
            }`}
          >
            {isPremium ? "PREMIUM" : "FREE"}
          </span>
          {isComingSoon ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
              Coming Soon
            </span>
          ) : null}
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onListen}
          className={`rounded-xl bg-gradient-to-r from-[#FFC107] to-[#FF9800] px-4 py-2 text-sm font-semibold text-[#1b1200] shadow-[0_8px_20px_rgba(255,152,0,0.35)] ${
            fullWidthButton ? "w-full" : ""
          }`}
        >
          Listen Now
        </motion.button>
      </div>
    </motion.article>
  );
}
