"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ContinueListeningItem } from "./types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

export function ContinueListening({
  item,
  onResume,
}: {
  item: ContinueListeningItem | null;
  onResume: () => void;
}) {
  if (!item) return null;
  const width = `${Math.max(0, Math.min(100, item.progressPercent))}%`;

  return (
    <section className="space-y-3">
      <h3 className="text-xl font-semibold text-white">Continue Listening</h3>
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#1F1F2E] p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
        <div className="overflow-hidden rounded-xl">
          <Image
            src={item.thumbnailUrl || FALLBACK_IMAGE}
            alt={item.title}
            width={120}
            height={160}
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
        <div>
          <p className="text-base font-semibold text-white">{item.title}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div style={{ width }} className="h-full rounded-full bg-gradient-to-r from-[#FFC107] to-[#FF9800]" />
          </div>
          <p className="mt-1 text-xs text-[#B0B0B0]">{item.progressPercent}% completed</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={onResume}
          className="w-full rounded-xl bg-gradient-to-r from-[#FFC107] to-[#FF9800] px-4 py-2 text-sm font-semibold text-[#1b1200] md:w-auto"
        >
          Resume
        </motion.button>
      </div>
    </section>
  );
}
