'use client';

import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import type { Book } from '@/lib/types';

export function BookActions({ book }: { book: Book }) {
  const router = useRouter();

  async function patch(update: Partial<Book>) {
    await clientApi(`/admin/books/${book._id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...book, ...update }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${book.title}?`)) return;
    await clientApi(`/admin/books/${book._id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="button secondary" onClick={() => router.push(`/dashboard/books/${book._id}/edit`)}>Edit</button>
      <button className="button secondary" onClick={() => router.push(`/dashboard/books/${book._id}/chapters`)}>Chapters</button>
      <button className="button secondary" onClick={() => patch({ isFeatured: !book.isFeatured })}>
        {book.isFeatured ? 'Unfeature' : 'Feature'}
      </button>
      <button className="button secondary" onClick={() => patch({ isTrending: !book.isTrending })}>
        {book.isTrending ? 'Untrend' : 'Trend'}
      </button>
      <button className="button danger" onClick={remove}>Delete</button>
    </div>
  );
}
