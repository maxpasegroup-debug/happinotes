'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import type { Chapter } from '@/lib/types';

const blank = {
  title: '',
  chapterNumber: 1,
  description: '',
  audioUrl: '',
  audioPublicId: '',
  durationSeconds: 0,
  isFreePreview: false,
};

export function ChapterManager({ bookId, chapters }: { bookId: string; chapters: Chapter[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...blank, chapterNumber: (chapters.at(-1)?.chapterNumber || 0) + 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function edit(chapter: Chapter) {
    setEditingId(chapter._id);
    setForm({
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      description: chapter.description,
      audioUrl: chapter.audioUrl,
      audioPublicId: chapter.audioPublicId,
      durationSeconds: chapter.durationSeconds,
      isFreePreview: chapter.isFreePreview,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const path = editingId ? `/admin/chapters/${editingId}` : `/admin/books/${bookId}/chapters`;
    try {
      await clientApi(path, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setEditingId(null);
      setForm({ ...blank, chapterNumber: form.chapterNumber + 1 });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chapter save failed');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete chapter?')) return;
    await clientApi(`/admin/chapters/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="grid">
      <form className="card form" onSubmit={submit}>
        <h2>{editingId ? 'Edit Chapter' : 'Add Chapter'}</h2>
        <div className="split">
          <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>Chapter Number</label><input type="number" value={form.chapterNumber} onChange={(e) => setForm({ ...form, chapterNumber: Number(e.target.value) })} /></div>
        </div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field"><label>Audio URL</label><input value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} /></div>
        <div className="split">
          <div className="field"><label>Audio Public ID</label><input value={form.audioPublicId} onChange={(e) => setForm({ ...form, audioPublicId: e.target.value })} /></div>
          <div className="field"><label>Duration Seconds</label><input type="number" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} /></div>
        </div>
        <label><input type="checkbox" checked={form.isFreePreview} onChange={(e) => setForm({ ...form, isFreePreview: e.target.checked })} /> Free Preview</label>
        {error ? <p className="error">{error}</p> : null}
        <button className="button">{editingId ? 'Update Chapter' : 'Add Chapter'}</button>
      </form>
      <div className="card">
        <h2>Chapters</h2>
        <table className="table">
          <thead><tr><th>No.</th><th>Title</th><th>Duration</th><th>Preview</th><th>Actions</th></tr></thead>
          <tbody>
            {chapters.map((chapter) => (
              <tr key={chapter._id}>
                <td>{chapter.chapterNumber}</td>
                <td>{chapter.title}</td>
                <td>{chapter.durationSeconds}s</td>
                <td>{chapter.isFreePreview ? 'Yes' : 'No'}</td>
                <td className="actions"><button className="button secondary" onClick={() => edit(chapter)}>Edit</button><button className="button danger" onClick={() => remove(chapter._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
