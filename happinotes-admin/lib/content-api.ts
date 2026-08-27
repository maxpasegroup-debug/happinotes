const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://happinotes-production-6b44.up.railway.app";

export type LifebookItem = {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  contentType: "lifebook" | "note" | "silence";
  type?: "free" | "premium";
  status?: "draft" | "coming_soon" | "live";
  webDisplayOrder?: number;
  mobileDisplayOrder?: number;
  lessons?: { title?: string; mediaUrl?: string }[];
  intro?: { title?: string; mediaUrl?: string; mediaType?: "audio" | "video" };
  conclusion?: { title?: string; mediaUrl?: string; mediaType?: "audio" | "video" };
};

function normalizeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const url = value.trim();
  if (url.startsWith("/")) return `${BASE_URL}${url}`;
  if (url.startsWith("uploads/")) return `${BASE_URL}/${url}`;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^http:\/\//i.test(url) && /railway\.app\//i.test(url)) return url.replace(/^http:/i, "https:");
  if (!/^https?:\/\//i.test(url) && /railway\.app\//i.test(url)) return `https://${url}`;
  return url;
}

function normalizeContent(item: LifebookItem): LifebookItem {
  return {
    ...item,
    thumbnailUrl: normalizeMediaUrl(item.thumbnailUrl || item.coverImageUrl),
    intro: item.intro ? { ...item.intro, mediaUrl: normalizeMediaUrl(item.intro.mediaUrl) } : item.intro,
    conclusion: item.conclusion ? { ...item.conclusion, mediaUrl: normalizeMediaUrl(item.conclusion.mediaUrl) } : item.conclusion,
    lessons: item.lessons?.map((lesson) => ({ ...lesson, mediaUrl: normalizeMediaUrl(lesson.mediaUrl) })),
  };
}

export async function getLiveLifebooks(): Promise<LifebookItem[]> {
  try {
    // The Flutter app consumes the mobile ordering and the same live/coming-soon
    // catalogue. Keeping this request identical prevents web and mobile feeds
    // from showing different books after an admin rearranges them.
    const res = await fetch(`${BASE_URL}/contents?type=lifebook&view=mobile`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { contents?: LifebookItem[] };
    return (data.contents || []).filter((item) => item.contentType === "lifebook").map(normalizeContent);
  } catch {
    return [];
  }
}

export async function getContentById(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE_URL}/contents/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: any };
    return data.content ? normalizeContent(data.content as LifebookItem) : null;
  } catch {
    return null;
  }
}

export { BASE_URL };
