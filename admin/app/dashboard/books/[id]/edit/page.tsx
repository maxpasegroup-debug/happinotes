import { BookForm } from '@/components/BookForm';
import { serverApi } from '@/lib/server-api';
import type { Book, Chapter } from '@/lib/types';

type Response = { success: boolean; book: Book; chapters: Chapter[] };

export default async function EditBookPage({ params }: { params: { id: string } }) {
  const data = await serverApi<Response>(`/admin/books/${params.id}`);
  return (
    <>
      <div className="page-head"><h1 className="title">Edit Book</h1></div>
      <BookForm book={data.book} />
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Existing Chapters</h2>
        <table className="table"><tbody>{data.chapters.map((chapter) => <tr key={chapter._id}><td>{chapter.chapterNumber}</td><td>{chapter.title}</td><td>{chapter.durationSeconds}s</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
