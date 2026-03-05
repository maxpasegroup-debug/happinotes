const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://happinotes-production.up.railway.app";

export type LifebookItem = {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentType: "lifebook" | "note" | "silence";
  type?: "free" | "premium";
  lessons?: { title?: string; mediaUrl?: string }[];
};

export async function getLiveLifebooks(): Promise<LifebookItem[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/contents?type=lifebook&status=live`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { contents?: LifebookItem[] };
    return (data.contents || []).filter((item) => item.contentType === "lifebook");
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
    return data.content || null;
  } catch {
    return null;
  }
}

export { BASE_URL };
