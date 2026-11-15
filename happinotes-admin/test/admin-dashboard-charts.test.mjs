import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookStatusCounts, monthlyUserSignups } from '../lib/admin-dashboard-charts.ts';

test('book status chart accounts for every book, including older unknown statuses', () => {
  const groups = bookStatusCounts([{ status: 'live' }, { status: 'live' }, { status: 'draft' }, { status: 'coming_soon' }, {}]);
  assert.deepEqual(groups.map(({ label, count }) => [label, count]), [['Published', 2], ['Coming soon', 1], ['Drafts', 1], ['Other', 1]]);
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), 5);
  assert.equal(bookStatusCounts([]).every((group) => group.count === 0), true);
});

test('signup chart handles year boundaries, missing dates, and future records', () => {
  const now = new Date(2026, 1, 15, 12);
  const users = [
    { createdAt: new Date(2025, 8, 1).toISOString() },
    { createdAt: new Date(2025, 11, 31, 23).toISOString() },
    { createdAt: new Date(2026, 0, 1).toISOString() },
    { createdAt: new Date(2026, 1, 15, 11).toISOString() },
    { createdAt: new Date(2025, 7, 31).toISOString() },
    { createdAt: new Date(2026, 1, 16).toISOString() },
    { createdAt: 'invalid' }, {},
  ];
  const result = monthlyUserSignups(users, now);
  assert.deepEqual(result.months.map(({ year, month, count }) => [year, month, count]), [
    [2025, 8, 1], [2025, 9, 0], [2025, 10, 0], [2025, 11, 1], [2026, 0, 1], [2026, 1, 1],
  ]);
  assert.equal(result.missingDates, 2);
  assert.deepEqual(monthlyUserSignups([], now).months.map(({ count }) => count), [0, 0, 0, 0, 0, 0]);
});

import { analyticsMonths, applicationCharts, distribution } from '../lib/admin-dashboard-charts.ts';

test('application charts include all records, separate media types and keep duration boundaries exact', () => {
  const snapshot = { books: [{ contentType: 'lifebook', type: 'premium', status: 'live', language: 'English' }, { contentType: 'lifebook', type: 'free', status: 'draft', language: 'english' }, { contentType: 'note', type: 'free' }], bites: [0, 59, 60, 299, 300, 1799, 1800, 7199, 7200].map((durationSeconds, i) => ({ durationSeconds, accessType: i % 2 ? 'premium' : 'free', published: i % 2 === 0, category: 'Focus' })), users: [{ blocked: false }, { blocked: true }], stats: { totalUsers: 2, activePremiumSubscribers: 1 }, loadedAt: Date.UTC(2026, 10, 14), failed: [] };
  const charts = applicationCharts(snapshot, 6);
  assert.equal(charts.books.length, 2);
  assert.deepEqual(charts.catalog.map(g => g.count), [2, 9]);
  assert.deepEqual(charts.durations.map(g => g.count), [1, 2, 2, 2, 1, 1]);
  assert.equal(charts.access.reduce((sum, g) => sum + g.count, 0), 11);
  assert.deepEqual(charts.languages.map(g => [g.label, g.count]), [['english', 2]]);
  assert.deepEqual(charts.membership.map(g => g.count), [1, 1]);
  assert.deepEqual(charts.accounts.map(g => g.count), [1, 1]);
});
test('analytics buckets use UTC, exclude invalid/future dates and cross year boundaries', () => {
  const data = analyticsMonths([{ createdAt: '2025-12-31T23:30:00-02:00' }, { createdAt: '2026-02-01T01:00:00Z' }, {}, { createdAt: '2026-03-01' }], 6, new Date('2026-02-15T00:00:00Z'));
  assert.deepEqual(data.rows.map(r => r.count), [0, 0, 0, 0, 1, 1]);
  assert.equal(data.excluded, 2);
  assert.equal(analyticsMonths([], 12, new Date('2026-02-15')).rows[0].key, '2025-03');
});
test('large categorical charts retain their full totals and unavailable membership is not zero', () => {
  const groups = distribution(Array.from({ length: 9 }, (_, i) => `Category ${i}`));
  assert.equal(groups.length, 7); assert.equal(groups.at(-1).count, 3);
  assert.equal(groups.reduce((sum, g) => sum + g.count, 0), 9);
  for (const stats of [null, { totalUsers: 1, activePremiumSubscribers: 2 }, { totalUsers: 5, activePremiumSubscribers: -1 }]) {
    assert.equal(applicationCharts({ books: null, bites: null, users: null, stats, loadedAt: Date.now(), failed: [] }, 6).membership, null);
  }
});
