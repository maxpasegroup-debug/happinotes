"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { LifebookItem } from "@/lib/content-api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

function durationText(item: LifebookItem): string {
  const count = item.lessons?.length || 6;
  return `${count * 7} min audio`;
}

export function HeroLifebook({
  item,
  onListen,
  onPreview,
}: {
  item: LifebookItem | null;
  onListen: (item: LifebookItem) => void;
  onPreview: (item: LifebookItem) => void;
}) {
  if (!item) return null;
  const isPremium = item.type === "premium";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1F1F2E] p-4 md:p-6"
    >
      <div className="absolute -left-10 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-[#FF9800]/20 blur-3xl" />
      <div className="relative grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="overflow-hidden rounded-2xl shadow-[0_0_40px_rgba(255,193,7,0.25)]">
          <Image
            src={item.thumbnailUrl || FALLBACK_IMAGE}
            alt={item.title}
            width={300}
            height={400}
            className="aspect-[3/4] w-full object-cover"
            priority
          />
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#B0B0B0]">Featured Lifebook</p>
          <h2 className="mt-2 text-3xl font-semibold text-white md:text-4xl">{item.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B0B0B0]">
            {item.description?.trim() || "A powerful wake-up call for growth, clarity, and life decisions."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white">
              {durationText(item)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPremium ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-[#00C853]/20 text-[#00C853]"
              }`}
            >
              {isPremium ? "PREMIUM" : "FREE"}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onListen(item)}
              className="rounded-xl bg-gradient-to-r from-[#FFC107] to-[#FF9800] px-5 py-2.5 text-sm font-semibold text-[#1b1200]"
            >
              ▶ Listen Now
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => onPreview(item)}
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white"
            >
              ▶ Preview 2 min
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
