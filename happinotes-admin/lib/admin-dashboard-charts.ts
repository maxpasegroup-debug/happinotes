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
