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
        kind: "intro",
      });
    }
    (content.lessons || []).forEach((lesson, idx) => {
      if (!lesson.mediaUrl) return;
      items.push({
        title: lesson.title || `Chapter ${idx + 1}`,
        description: lesson.description || "",
        mediaUrl: lesson.mediaUrl,
        kind: "chapter",
      });
    });
    if (content.conclusion?.mediaUrl) {
      items.push({
        title: content.conclusion.title || "Conclusion",
        description: content.conclusion.description || "",
        mediaUrl: content.conclusion.mediaUrl,
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

  const bg = content?.thumbnailUrl || "";
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
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div
        className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden"
        style={{
          backgroundImage: bg
            ? `linear-gradient(180deg, rgba(11,15,26,.65), rgba(11,15,26,.96)), url(${bg})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="px-5 pb-24 pt-8">
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.35)]">
            <img src={thumb} alt={content?.title || "Lifebook"} className="h-[300px] w-full object-cover" />
          </div>

          <div className="mt-4">
            <h1 className="bg-gradient-to-r from-[#f6c453] to-[#e6a92c] bg-clip-text text-3xl font-bold text-transparent">
              {content?.title || "Lifebook"}
            </h1>
            {content?.description ? (
              <p className="mt-2 text-sm leading-6 text-[#d7deee]">{content.description}</p>
            ) : (
              <p className="mt-2 text-sm text-[#b7c0d8]">Practical audio lessons for real life growth.</p>
            )}
          </div>

          {premiumBlocked ? (
            <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              This is a premium lifebook. Subscribe from Profile to listen.
            </p>
          ) : null}

          {chapters.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[#b7c0d8]">Intro & Chapters</p>
              {chapters.map((item, idx) => {
                const active = idx === chapterIndex && miniOpen;
                return (
                  <button
                    key={`${item.title || "chapter"}-${idx}`}
                    type="button"
                    disabled={premiumBlocked}
                    onClick={() => {
                      setChapterIndex(idx);
                      setMiniOpen(true);
                      if (!premiumBlocked) setIsPlaying(true);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                      active
                        ? "border-[#f6c453]/60 bg-[#f6c453]/15"
                        : "border-white/10 bg-black/30"
                    } ${premiumBlocked ? "opacity-70" : "hover:bg-black/40"}`}
                  >
                    <img src={thumb} alt="Thumb" className="h-11 w-11 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                      <p className="line-clamp-1 text-xs text-[#b7c0d8]">
                        {item.kind === "intro" ? "Introduction" : item.kind === "conclusion" ? "Conclusion" : "Chapter"}
                      </p>
                    </div>
                    <span className="text-xs text-[#f6c453]">{active ? "Playing" : "Play"}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <Link href="/" className="mt-8 inline-block text-sm text-[#f6c453]">
            Back to Lifebooks
          </Link>
        </div>

        {miniOpen && chapter ? (
          <div
            className="fixed z-50 w-[320px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border border-white/20 bg-[#0d1220]/95 shadow-[0_16px_32px_rgba(0,0,0,0.45)] backdrop-blur"
            style={{ left: playerPos.x, top: playerPos.y }}
          >
            <div
              onPointerDown={startDrag}
              className="flex cursor-grab items-center justify-between bg-black/30 px-3 py-2 active:cursor-grabbing"
            >
              <p className="line-clamp-1 text-xs font-semibold tracking-wide text-[#f6c453]">Floating Player</p>
              <button
                type="button"
                onClick={() => {
                  setMiniOpen(false);
                  setIsPlaying(false);
                }}
                className="text-xs text-white/80"
              >
                Close
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-3">
                <img src={thumb} alt="Thumbnail" className="h-16 w-16 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{chapter.title}</p>
                  <p className="line-clamp-1 text-xs text-[#b7c0d8]">{content?.title}</p>
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
                className="mt-3 w-full accent-[#f6c453]"
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setChapterIndex((prev) => Math.max(prev - 1, 0))}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs"
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
                  className="rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] px-4 py-2 text-xs font-semibold text-[#211100]"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setChapterIndex((prev) => Math.min(prev + 1, Math.max(chapters.length - 1, 0)))
                  }
                  className="rounded-full border border-white/20 px-3 py-1 text-xs"
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
                className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs text-[#f6c453]"
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
