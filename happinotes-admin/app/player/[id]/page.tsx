"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BASE_URL } from "@/lib/content-api";
import { BottomNav } from "@/components/bottom-nav";
import { getStoredUser } from "@/lib/user-session";

type Section = {
  title?: string;
  description?: string;
  mediaUrl?: string;
  duration?: number;
};

type Content = {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  type?: "free" | "premium";
  intro?: Section;
  lessons?: Section[];
  conclusion?: Section;
};

type ChapterItem = {
  title: string;
  description?: string;
  mediaUrl: string;
  duration?: number;
  kind: "intro" | "chapter" | "conclusion";
};

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const [content, setContent] = useState<Content | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [miniOpen, setMiniOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: 16, y: 92 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${BASE_URL}/contents/${params.id}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { content?: Content };
      const item = data.content || null;
      setContent(item);
      const user = getStoredUser();
      if (item?.type === "premium" && !user?.subscriptionActive) {
        setPremiumBlocked(true);
      }
    }
    load().catch(() => undefined);
  }, [params.id]);

  const chapters = useMemo(() => {
    if (!content) return [] as ChapterItem[];
    const items: ChapterItem[] = [];
    if (content.intro?.mediaUrl) {
      items.push({
        title: content.intro.title || "Introduction",
        description: content.intro.description || "",
        mediaUrl: content.intro.mediaUrl,
        duration: content.intro.duration,
        kind: "intro",
      });
    }
    (content.lessons || []).forEach((lesson, idx) => {
      if (!lesson.mediaUrl) return;
      items.push({
        title: lesson.title || `Chapter ${idx + 1}`,
        description: lesson.description || "",
        mediaUrl: lesson.mediaUrl,
        duration: lesson.duration,
        kind: "chapter",
      });
    });
    if (content.conclusion?.mediaUrl) {
      items.push({
        title: content.conclusion.title || "Conclusion",
        description: content.conclusion.description || "",
        mediaUrl: content.conclusion.mediaUrl,
        duration: content.conclusion.duration,
        kind: "conclusion",
      });
    }
    return items;
  }, [content]);

  const chapter = chapters[chapterIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !chapter?.mediaUrl || premiumBlocked || !miniOpen) return;
    audio.src = chapter.mediaUrl;
    audio.playbackRate = speed;
    if (isPlaying) {
      audio.play().catch(() => undefined);
    }
  }, [chapterIndex, chapter?.mediaUrl, isPlaying, speed, premiumBlocked, miniOpen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setProgress(audio.currentTime || 0);
      setDuration(audio.duration || 1);
    };
    const onEnded = () => {
      if (chapterIndex < chapters.length - 1) {
        setChapterIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [chapterIndex, chapters.length]);

  const thumb = content?.thumbnailUrl || "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop";

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      setPlayerPos({
        x: Math.max(8, e.clientX - dragOffsetRef.current.x),
        y: Math.max(8, e.clientY - dragOffsetRef.current.y),
      });
    }

    function onPointerUp() {
      draggingRef.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function startDrag(e: any) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    draggingRef.current = true;
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#111111]">
      <div
        className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden"
      >
        <div className="px-0 pb-24 pt-0">
          <div className="relative h-[260px] w-full overflow-hidden bg-black">
            <img src={thumb} alt={content?.title || "Lifebook"} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
          </div>

          <div className="px-5 pb-3 pt-4">
            <h1 className="text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {content?.title || "Lifebook"}
            </h1>
            {content?.description ? (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#4b5563]">{content.description}</p>
            ) : null}
          </div>

          <div className="px-5">
            {premiumBlocked ? (
              <button
                type="button"
                className="w-full rounded-full bg-black px-5 py-3 text-center text-lg font-semibold text-white"
              >
                Get Access
              </button>
            ) : (
              <button
                type="button"
                className="w-full rounded-full bg-black px-5 py-3 text-center text-lg font-semibold text-white"
              >
                Continue Listening
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center gap-6 border-b border-black/10 px-5">
            <span className="pb-2 text-lg font-medium text-[#6b7280]">Overview</span>
            <span className="border-b-[3px] border-black pb-2 text-lg font-semibold text-black">Lessons</span>
            <span className="pb-2 text-lg font-medium text-[#9ca3af]">Resources</span>
          </div>

          {chapters.length > 0 ? (
            <div className="mt-4 space-y-2 px-5">
              {chapters.map((item, idx) => {
                const active = idx === chapterIndex && miniOpen;
                const label =
                  item.kind === "intro" ? `INTRO ${idx + 1}` : item.kind === "conclusion" ? "CONCLUSION" : `LESSON ${idx + 1}`;
                const isPreview = item.kind === "intro";
                const locked = premiumBlocked && !isPreview;
                return (
                  <button
                    key={`${item.title || "chapter"}-${idx}`}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setChapterIndex(idx);
                      setMiniOpen(true);
                      if (!locked) setIsPlaying(true);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl bg-white px-2 py-2 text-left shadow-sm ${
                      active
                        ? "ring-2 ring-black/20"
                        : ""
                    } ${locked ? "opacity-70" : ""}`}
                  >
                    <img src={thumb} alt="Thumb" className="h-20 w-40 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#4b5563]">{label}</p>
                      <p className="line-clamp-2 text-base font-semibold leading-6 text-[#111111]">
                        {item.title}
                      </p>
                      {item.duration ? (
                        <p className="mt-1 text-sm text-[#6b7280]">{Math.max(1, Math.round(item.duration / 60))} mins</p>
                      ) : null}
                      {isPreview ? (
                        <span className="mt-1 inline-flex rounded-md bg-black px-2 py-[1px] text-[10px] font-bold tracking-wide text-white">
                          PREVIEW
                        </span>
                      ) : null}
                    </div>
                    <div className="pr-1 text-[#6b7280]">
                      {locked ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      ) : active ? (
                        <span className="text-xs font-semibold text-black">Playing</span>
                      ) : (
                        <span className="text-xs font-semibold text-[#374151]">Play</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          <Link href="/" className="mt-8 inline-block px-5 text-sm text-[#111111] underline">
            Back to Lifebooks
          </Link>
        </div>

        {miniOpen && chapter ? (
          <div
            className="fixed z-50 w-[320px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_16px_32px_rgba(0,0,0,0.28)]"
            style={{ left: playerPos.x, top: playerPos.y }}
          >
            <div
              onPointerDown={startDrag}
              className="flex cursor-grab items-center justify-between bg-black px-3 py-2 active:cursor-grabbing"
            >
              <p className="line-clamp-1 text-xs font-semibold tracking-wide text-white">Floating Player</p>
              <button
                type="button"
                onClick={() => {
                  setMiniOpen(false);
                  setIsPlaying(false);
                }}
                className="text-xs text-white"
              >
                Close
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-3">
                <img src={thumb} alt="Thumbnail" className="h-16 w-16 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-[#111111]">{chapter.title}</p>
                  <p className="line-clamp-1 text-xs text-[#6b7280]">{content?.title}</p>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={duration}
                value={progress}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setProgress(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="mt-3 w-full accent-black"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setChapterIndex((prev) => Math.max(prev - 1, 0))}
                  className="rounded-full border border-black/20 px-3 py-1 text-xs text-black"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (premiumBlocked) return;
                    const audio = audioRef.current;
                    if (!audio) return;
                    if (isPlaying) {
                      audio.pause();
                      setIsPlaying(false);
                    } else {
                      await audio.play().catch(() => undefined);
                      setIsPlaying(true);
                    }
                  }}
                  className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setChapterIndex((prev) => Math.min(prev + 1, Math.max(chapters.length - 1, 0)))
                  }
                  className="rounded-full border border-black/20 px-3 py-1 text-xs text-black"
                >
                  Next
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (premiumBlocked) return;
                  const idx = speeds.indexOf(speed);
                  const next = speeds[(idx + 1) % speeds.length];
                  setSpeed(next);
                  if (audioRef.current) audioRef.current.playbackRate = next;
                }}
                className="mt-2 rounded-full border border-black/20 px-3 py-1 text-xs text-black"
              >
                Speed {speed}x
              </button>
            </div>
          </div>
        ) : null}

        <audio ref={audioRef} preload="metadata" />
        <BottomNav />
      </div>
    </div>
  );
}
