"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BASE_URL } from "@/lib/content-api";
import { BottomNav } from "@/components/bottom-nav";
import { getStoredUser } from "@/lib/user-session";

type Section = {
  title?: string;
  mediaUrl?: string;
};

type Content = {
  title?: string;
  thumbnailUrl?: string;
  type?: "free" | "premium";
  intro?: Section;
  lessons?: Section[];
  conclusion?: Section;
};

const speeds = [1, 1.25, 1.5, 2];

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const [content, setContent] = useState<Content | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (!content) return [] as Section[];
    const items: Section[] = [];
    if (content.intro) items.push({ ...content.intro, title: content.intro.title || "Introduction" });
    (content.lessons || []).forEach((lesson, idx) => {
      items.push({ ...lesson, title: lesson.title || `Lesson ${idx + 1}` });
    });
    if (content.conclusion) items.push({ ...content.conclusion, title: content.conclusion.title || "Conclusion" });
    return items.filter((x) => Boolean(x.mediaUrl));
  }, [content]);

  const chapter = chapters[chapterIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !chapter?.mediaUrl || premiumBlocked) return;
    audio.src = chapter.mediaUrl;
    audio.playbackRate = speed;
    if (isPlaying) {
      audio.play().catch(() => undefined);
    }
  }, [chapterIndex, chapter?.mediaUrl, isPlaying, speed, premiumBlocked]);

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
        <div className="px-5 pb-24 pt-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#b7c0d8]">Now Playing</p>
          <h1 className="mt-2 text-3xl font-bold">{content?.title || "Lifebook Player"}</h1>
          <p className="mt-2 text-sm text-[#b7c0d8]">{chapter?.title || "Chapter"}</p>

          <div className="mx-auto mt-10 max-w-sm rounded-3xl bg-black/30 p-6 backdrop-blur">
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
              className="w-full accent-[#f6c453]"
            />

            <div className="mt-6 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => setChapterIndex((prev) => Math.max(prev - 1, 0))}
                className="rounded-full border border-white/20 px-4 py-2 text-sm"
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
                className="h-16 w-16 rounded-full bg-gradient-to-r from-[#f6c453] to-[#e6a92c] text-lg font-semibold text-[#211100]"
              >
                {isPlaying ? "II" : "▶"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setChapterIndex((prev) => Math.min(prev + 1, Math.max(chapters.length - 1, 0)))
                }
                className="rounded-full border border-white/20 px-4 py-2 text-sm"
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
              className="mt-6 rounded-full border border-white/20 px-4 py-2 text-sm text-[#f6c453]"
            >
              Speed {speed}x
            </button>
            {premiumBlocked ? (
              <p className="mt-4 text-sm text-amber-300">
                This is a premium Lifebook. Please subscribe from Profile.
              </p>
            ) : null}
          </div>

          <Link href="/" className="mt-8 inline-block text-sm text-[#f6c453]">
            Back to Lifebooks
          </Link>
        </div>

        <audio ref={audioRef} preload="metadata" />
        <BottomNav />
      </div>
    </div>
  );
}
