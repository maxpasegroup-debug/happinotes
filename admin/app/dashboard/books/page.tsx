import Link from 'next/link';
import { BookActions } from '@/components/BookActions';
import { serverApi } from '@/lib/server-api';
import type { Book } from '@/lib/types';

type BooksResponse = { success: boolean; books: Book[] };

export default async function BooksPage({
  searchParams,
}: {
  searchParams: { status?: string; language?: string; category?: string };
}) {
  const data = await serverApi<BooksResponse>('/admin/books');
  const books = data.books.filter((book) =>
    (!searchParams.status || book.status === searchParams.status) &&
    (!searchParams.language || book.language === searchParams.language) &&
    (!searchParams.category || book.category === searchParams.category)
  );

  return (
    <>
      <div className="page-head">
        <h1 className="title">Books</h1>
        <Link className="button" href="/dashboard/books/create">Create New Book</Link>
      </div>
      <form className="actions" style={{ marginBottom: 16 }}>
        <select name="status" defaultValue={searchParams.status || ''}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
        </select>
        <select name="language" defaultValue={searchParams.language || ''}>
          <option value="">All languages</option>
          <option value="english">English</option>
          <option value="malayalam">Malayalam</option>
          <option value="hindi">Hindi</option>
        </select>
        <select name="category" defaultValue={searchParams.category || ''}>
          <option value="">All categories</option>
          <option value="health">Health</option>
          <option value="wealth">Wealth</option>
          <option value="happiness">Happiness</option>
          <option value="mindfulness">Mindfulness</option>
        </select>
        <button className="button secondary">Filter</button>
      </form>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Language</th><th>Status</th><th>Access</th><th>Chapters</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book._id}>
                <td>{book.title}</td>
                <td>{book.language}</td>
                <td><span className="badge">{book.status}</span></td>
                <td>{book.accessType}</td>
                <td>{book.chaptersCount || 0}</td>
                <td><BookActions book={book} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
