import Link from "next/link";
import { BASE_URL } from "@/lib/api";

export const revalidate = 30;

type ContentItem = {
  _id: string;
  title: string;
  thumbnailUrl: string;
  contentType: "lifebook" | "note" | "silence";
  featured?: boolean;
};

type ContentsResponse = {
  success: boolean;
  contents: ContentItem[];
};

async function getLiveContents(): Promise<ContentItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/contents?status=live`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ContentsResponse;
    return Array.isArray(data.contents) ? data.contents : [];
  } catch {
    return [];
  }
}

function byPriority(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => Number(b.featured) - Number(a.featured));
}

function Row({
  title,
  items,
  reverse,
}: {
  title: string;
  items: ContentItem[];
  reverse?: boolean;
}) {
  const doubled = [...items, ...items];
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 22, marginBottom: 12 }}>{title}</h2>
      <div style={{ overflow: "hidden" }}>
        <div className={`auto-scroll ${reverse ? "scroll-right" : "scroll-left"}`}>
          {doubled.map((item, idx) => (
            <article
              key={`${item._id}-${idx}`}
              style={{
                width: 220,
                minWidth: 220,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid #1f1f23",
                background: "#0f0f13",
                position: "relative",
                transition: "transform .25s ease, box-shadow .25s ease",
              }}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                style={{
                  width: "100%",
                  height: 300,
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(0deg, rgba(0,0,0,.86) 0%, rgba(0,0,0,0) 55%)",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 14,
                }}
              >
                <div style={{ width: "100%" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                  <div style={{ marginTop: 6, color: "#f97316" }}>▶ Play</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function LandingPage() {
  const contents = byPriority(await getLiveContents());
  const lifebooks = contents.filter((c) => c.contentType === "lifebook");
  const notes = contents.filter((c) => c.contentType === "note");
  const happiness = contents.filter((c) => c.contentType === "silence");

  return (
    <main style={{ minHeight: "100vh", padding: "26px 32px 40px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 24 }}>Happinotes</div>
        <Link
          href="/admin/login"
          style={{
            border: "1px solid #2f2f35",
            borderRadius: 10,
            padding: "10px 16px",
            fontWeight: 600,
            background: "#111217",
          }}
        >
          ADMIN LOGIN
        </Link>
      </header>

      <section style={{ marginTop: 46, display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: 0 }}>
            Practical Books for Real Life
          </h1>
          <p style={{ marginTop: 14, color: "#a1a1aa", fontSize: 20 }}>
            Listen • Learn • Transform
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              style={{
                background: "#f97316",
                color: "#fff",
                border: 0,
                borderRadius: 10,
                padding: "12px 16px",
                fontWeight: 700,
              }}
            >
              Download for Android
            </button>
            <button
              style={{
                background: "#18181b",
                color: "#fff",
                border: "1px solid #2a2a2f",
                borderRadius: 10,
                padding: "12px 16px",
                fontWeight: 700,
              }}
            >
              Download for iOS
            </button>
          </div>
        </div>
      </section>

      <Row title="Lifebooks" items={lifebooks} />
      <Row title="Notes" items={notes} reverse />
      <Row title="Happiness" items={happiness} />
    </main>
  );
}
