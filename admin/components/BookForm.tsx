'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { z } from 'zod';
import { clientApi } from '@/lib/client-api';
import type { Book } from '@/lib/types';

const schema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  language: z.enum(['english', 'malayalam', 'hindi']),
  category: z.enum(['health', 'wealth', 'happiness', 'mindfulness']),
  accessType: z.enum(['free', 'premium']),
  status: z.enum(['draft', 'upcoming', 'live']),
});

const emptyBook: Partial<Book> = {
  title: '',
  description: '',
  language: 'english',
  category: 'health',
  coverImageUrl: '',
  coverPublicId: '',
  introAudioUrl: '',
  introAudioPublicId: '',
  totalDurationSeconds: 0,
  accessType: 'free',
  status: 'draft',
  isFeatured: false,
  isTrending: false,
  sortOrder: 0,
  tags: [],
};

export function BookForm({ book }: { book?: Book }) {
  const router = useRouter();
  const [form, setForm] = useState<Partial<Book>>(book || emptyBook);
  const [tags, setTags] = useState((book?.tags || []).join(', '));
  const [error, setError] = useState('');

  function update(key: keyof Book, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError('Please fill all required fields.');
      return;
    }
    const payload = {
      ...form,
      totalDurationSeconds: Number(form.totalDurationSeconds || 0),
      sortOrder: Number(form.sortOrder || 0),
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      const path = book ? `/admin/books/${book._id}` : '/admin/books';
      await clientApi(path, { method: book ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      router.push('/dashboard/books');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <div className="field"><label>Title</label><input value={form.title || ''} onChange={(e) => update('title', e.target.value)} /></div>
      <div className="field"><label>Description</label><textarea value={form.description || ''} onChange={(e) => update('description', e.target.value)} /></div>
      <div className="split">
        <div className="field"><label>Language</label><select value={form.language} onChange={(e) => update('language', e.target.value)}><option value="english">English</option><option value="malayalam">Malayalam</option><option value="hindi">Hindi</option></select></div>
        <div className="field"><label>Category</label><select value={form.category} onChange={(e) => update('category', e.target.value)}><option value="health">Health</option><option value="wealth">Wealth</option><option value="happiness">Happiness</option><option value="mindfulness">Mindfulness</option></select></div>
      </div>
      <div className="split">
        <div className="field"><label>Access Type</label><select value={form.accessType} onChange={(e) => update('accessType', e.target.value)}><option value="free">Free</option><option value="premium">Premium</option></select></div>
        <div className="field"><label>Status</label><select value={form.status} onChange={(e) => update('status', e.target.value)}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="live">Live</option></select></div>
      </div>
      <div className="field"><label>Cover Image URL</label><input value={form.coverImageUrl || ''} onChange={(e) => update('coverImageUrl', e.target.value)} /></div>
      <div className="field"><label>Intro Audio URL</label><input value={form.introAudioUrl || ''} onChange={(e) => update('introAudioUrl', e.target.value)} /></div>
      <div className="split">
        <div className="field"><label>Total Duration Seconds</label><input type="number" value={form.totalDurationSeconds || 0} onChange={(e) => update('totalDurationSeconds', e.target.value)} /></div>
        <div className="field"><label>Sort Order</label><input type="number" value={form.sortOrder || 0} onChange={(e) => update('sortOrder', e.target.value)} /></div>
      </div>
      <div className="field"><label>Tags</label><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="health, habits" /></div>
      <div className="actions">
        <label><input type="checkbox" checked={Boolean(form.isFeatured)} onChange={(e) => update('isFeatured', e.target.checked)} /> Featured</label>
        <label><input type="checkbox" checked={Boolean(form.isTrending)} onChange={(e) => update('isTrending', e.target.checked)} /> Trending</label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="button">Save Book</button>
    </form>
  );
}
