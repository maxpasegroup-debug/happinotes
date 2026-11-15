export function bookStatusCounts(books: ReadonlyArray<{ status?: string }>) {
  return [
    { label: 'Published', color: '#f27055', count: books.filter((book) => book.status === 'live').length },
    { label: 'Coming soon', color: '#f5b74f', count: books.filter((book) => book.status === 'coming_soon').length },
    { label: 'Drafts', color: '#8490a6', count: books.filter((book) => book.status === 'draft').length },
    { label: 'Other', color: '#a78bfa', count: books.filter((book) => !['live', 'coming_soon', 'draft'].includes(book.status ?? '')).length },
  ].filter((group) => group.label !== 'Other' || group.count > 0);
}

/** Calendar months in the admin's local timezone; invalid dates are never invented. */
export function monthlyUserSignups(users: ReadonlyArray<{ createdAt?: string }>, now: Date) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { year: date.getFullYear(), month: date.getMonth(), label: date.toLocaleDateString('en', { month: 'short' }), count: 0 };
  });
  let missingDates = 0;
  for (const user of users) {
    const joined = user.createdAt ? new Date(user.createdAt) : null;
    if (!joined || !Number.isFinite(joined.getTime())) { missingDates++; continue; }
    if (joined.getTime() > now.getTime()) continue;
    const month = months.find((item) => item.year === joined.getFullYear() && item.month === joined.getMonth());
    if (month) month.count++;
  }
  return { months, missingDates };
}

export type AnalyticsBook = { contentType?: string; status?: string; type?: string; language?: string; createdAt?: string };
export type AnalyticsBite = { published?: boolean; accessType?: string; category?: string; durationSeconds?: number; createdAt?: string };
export type AnalyticsUser = { createdAt?: string; blocked?: boolean };
export type AnalyticsStats = { totalUsers: number; activePremiumSubscribers: number };
export type AnalyticsSnapshot = { books: AnalyticsBook[] | null; bites: AnalyticsBite[] | null; users: AnalyticsUser[] | null; stats: AnalyticsStats | null; loadedAt: number; failed: string[] };
export type ChartGroup = { label: string; count: number; color: string };
const chartColors = ['#fb923c', '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8'];
export function distribution(values: string[]): ChartGroup[] {
  const counts = new Map<string, number>();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = rows.slice(0, 6);
  if (rows.length > 6) shown.push(['Other categories', rows.slice(6).reduce((sum, row) => sum + row[1], 0)]);
  return shown.map(([label, count], i) => ({ label, count, color: chartColors[i] }));
}
/** UTC calendar buckets, with no invented dates for historical records. */
export function analyticsMonths(items: ReadonlyArray<{ createdAt?: string }>, months: 6 | 12, now: Date) {
  const rows = Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1 + i, 1));
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }), year: date.getUTCFullYear(), count: 0 };
  });
  let excluded = 0;
  for (const item of items) {
    const time = Date.parse(item.createdAt || '');
    if (!Number.isFinite(time) || time > now.getTime()) { excluded++; continue; }
    const row = rows.find(row => row.key === new Date(time).toISOString().slice(0, 7));
    if (row) row.count++;
  }
  return { rows, excluded };
}
export function applicationCharts(data: AnalyticsSnapshot, months: 6 | 12) {
  const books = (data.books || []).filter(item => item.contentType === 'lifebook');
  const bites = data.bites || [], users = data.users || [], now = new Date(data.loadedAt);
  const access = [...books.map(item => item.type === 'free' ? 'Free' : item.type === 'premium' ? 'Paid access' : 'Unknown'), ...bites.map(item => !item.accessType || item.accessType === 'free' ? 'Free' : item.accessType === 'premium' ? 'Paid access' : 'Unknown')];
  const durations = ['Under 1 min', '1–5 min', '5–30 min', '30–120 min', '2+ hours', 'Not measured'].map((label, index) => ({ label, color: chartColors[index], count: bites.filter(bite => {
    const seconds = bite.durationSeconds;
    const bucket = typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 ? 5 : seconds < 60 ? 0 : seconds < 300 ? 1 : seconds < 1800 ? 2 : seconds < 7200 ? 3 : 4;
    return bucket === index;
  }).length }));
  const total = data.stats?.totalUsers, premium = data.stats?.activePremiumSubscribers;
  const membership = typeof total === 'number' && Number.isInteger(total) && total >= 0 && typeof premium === 'number' && Number.isInteger(premium) && premium >= 0 && premium <= total ? [{ label: 'Active Pro', count: premium, color: '#fb923c' }, { label: 'No active Pro', count: total - premium, color: '#475569' }] : null;
  return {
    books, bites, users,
    signups: analyticsMonths(users, months, now), bookGrowth: analyticsMonths(books, months, now), biteGrowth: analyticsMonths(bites, months, now),
    catalog: [{ label: 'Story Books', count: books.length, color: '#fb923c' }, { label: 'Happy Bites', count: bites.length, color: '#38bdf8' }],
    publication: [...bookStatusCounts(books).map(group => ({ ...group, label: `Books · ${group.label}` })), { label: 'Bites · Published', count: bites.filter(item => item.published === true).length, color: '#38bdf8' }, { label: 'Bites · Drafts', count: bites.filter(item => item.published !== true).length, color: '#64748b' }],
    access: distribution(access), membership,
    languages: distribution(books.map(item => item.language?.trim().toLowerCase() || 'Not specified')),
    categories: distribution(bites.map(item => item.category?.trim().toLowerCase() || 'Uncategorized')),
    durations,
    accounts: [{ label: 'Not blocked', count: users.filter(item => !item.blocked).length, color: '#34d399' }, { label: 'Blocked', count: users.filter(item => item.blocked).length, color: '#fb7185' }],
  };
}
