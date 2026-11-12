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
