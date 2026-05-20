import { ChapterManager } from '@/components/ChapterManager';
import { serverApi } from '@/lib/server-api';
import type { Book, Chapter } from '@/lib/types';

type Response = { success: boolean; book: Book; chapters: Chapter[] };

export default async function ChaptersPage({ params }: { params: { id: string } }) {
  const data = await serverApi<Response>(`/admin/books/${params.id}`);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Chapters</h1>
          <p className="muted">{data.book.title}</p>
        </div>
      </div>
      <ChapterManager bookId={params.id} chapters={data.chapters} />
    </>
  );
}
