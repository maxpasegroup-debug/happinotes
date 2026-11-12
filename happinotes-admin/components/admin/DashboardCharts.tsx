'use client';

import { Card, CardBody, Skeleton, Spinner } from '@heroui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { bookStatusCounts, monthlyUserSignups } from '@/lib/admin-dashboard-charts';

export type DashboardOverviewState = { status: 'loading' | 'ready' | 'error'; loadedAt: number };

export default function DashboardCharts({ books, users, state }: {
  books: ReadonlyArray<{ status?: string }>;
  users: ReadonlyArray<{ createdAt?: string }>;
  state: DashboardOverviewState;
}) {
  const reducedMotion = useReducedMotion();
  const reveal = { opacity: 1, y: 0 };
  const initial = reducedMotion ? false : { opacity: 0, y: 6 };
  if (state.status !== 'ready') return <div className="grid gap-4 md:grid-cols-2" aria-busy={state.status === 'loading'}>
    {['Story Books', 'Users'].map((title, index) => <Card key={title} shadow="none" className="min-w-0 border border-divider bg-content1"><CardBody className="p-4 sm:p-5">
      <div className="flex items-center justify-between"><h2 className="!text-sm">{title}</h2>{state.status === 'loading' ? <Spinner aria-hidden="true" size="sm" color="primary" className="motion-reduce:[&_*]:animate-none" /> : null}</div>
      {state.status === 'loading' ? <div role="status" className="mt-3">
        <Skeleton className="h-3 w-32 rounded-md motion-reduce:before:animate-none" />
        {index === 0 ? <div className="mt-4 flex h-32 items-center gap-5">
          <div className="relative h-28 w-28 shrink-0"><Skeleton className="h-full w-full rounded-full motion-reduce:before:animate-none" /><div className="absolute inset-3 rounded-full bg-content1" /></div>
          <div className="flex-1 space-y-4">{[0, 1, 2].map((row) => <div key={row} className="flex items-center gap-2"><Skeleton className="h-2 w-2 rounded-full motion-reduce:before:animate-none" /><Skeleton className="h-2 flex-1 rounded-md motion-reduce:before:animate-none" /></div>)}</div>
        </div> : <svg aria-hidden="true" viewBox="0 0 420 150" className="mt-4 h-32 w-full">
          {[38, 65, 50, 85, 70, 100].map((height, bar) => <motion.rect key={bar} x={25 + bar * 66} y={125 - height} width="32" height={height} rx="5" fill="currentColor" className="text-primary/25"
            animate={reducedMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.9, 0.3] }} transition={reducedMotion ? { duration: 0 } : { duration: 1.25, repeat: Infinity, delay: bar * 0.1 }} />)}
        </svg>}
        <span className="sr-only">Loading {title.toLowerCase()} chart</span>
      </div> : <p role="status" className="flex min-h-40 items-center justify-center text-center text-xs text-default-400">Chart unavailable. Refresh to try again.</p>}
    </CardBody></Card>)}
  </div>;

  const groups = bookStatusCounts(books);
  const { months, missingDates } = monthlyUserSignups(users, new Date(state.loadedAt));
  const recentUsers = months.reduce((sum, month) => sum + month.count, 0);
  const maximum = Math.max(1, ...months.map((month) => month.count));
  const ringLength = 2 * Math.PI * 58;

  return <motion.div key="charts-ready" initial={initial} animate={reveal} transition={{ duration: reducedMotion ? 0 : 0.25 }} className="grid gap-4 md:grid-cols-2">
    <Card shadow="none" className="min-w-0 border border-divider bg-content1"><CardBody className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="!text-sm">Story Books</h2><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">By status</span></div>
      <p className="mt-1.5 text-[11px] text-default-400">Your library by publication status</p>
      <div className="mt-3 flex min-h-32 items-center gap-4">
        <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
          <svg role="img" aria-label={`${books.length} story books. ${groups.map((group) => `${group.label}: ${group.count}`).join('. ')}.`} viewBox="0 0 160 160" className="h-full w-full">
            <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeWidth="12" className="text-default-100" />
            {groups.map((group, index) => {
              const offset = groups.slice(0, index).reduce((sum, item) => sum + item.count, 0);
              return group.count && books.length ? <motion.circle key={group.label} cx="80" cy="80" r="58" fill="none" stroke={group.color} strokeWidth="12"
                initial={reducedMotion ? false : { strokeDasharray: `0 ${ringLength}` }}
                animate={{ strokeDasharray: `${group.count / books.length * ringLength} ${ringLength}` }}
                transition={{ duration: reducedMotion ? 0 : 0.7, ease: 'easeOut', delay: reducedMotion ? 0 : index * 0.06 }}
                strokeDashoffset={-offset / books.length * ringLength} transform="rotate(-90 80 80)">
                <title>{group.label}: {group.count} ({Math.round(group.count / books.length * 100)}%)</title>
              </motion.circle> : null;
            })}
          </svg>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold tracking-tight tabular-nums">{books.length}</span><span className="mt-0.5 text-[10px] text-default-400">Total books</span></div>
        </div>
        <ul className="min-w-0 flex-1 space-y-3">{groups.map((group) => <li key={group.label} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2 text-default-400"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: group.color }} />{group.label}</span>
          <span className="font-semibold tabular-nums">{group.count}</span>
        </li>)}</ul>
      </div>
      {!books.length ? <p className="mt-2 text-[11px] text-default-400">Add your first book to start building your library.</p> : null}
    </CardBody></Card>

    <Card shadow="none" className="min-w-0 border border-divider bg-content1"><CardBody className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="!text-sm">Users</h2><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">Last 6 months</span></div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-2xl font-semibold tracking-tight tabular-nums">{users.length}</span><span className="text-[11px] text-default-400">accounts · +{recentUsers} in 6 months</span></div>
      <svg role="img" aria-label={`New user accounts per month. ${months.map((month) => `${month.label} ${month.year}: ${month.count}`).join('. ')}.`} viewBox="0 0 420 170" className="mt-2 h-28 w-full">
        {[25, 75, 125].map((y) => <line key={y} x1="12" x2="408" y1={y} y2={y} stroke="currentColor" className="text-default-100" strokeDasharray="4 5" />)}
        {months.map((month, index) => {
          const height = month.count / maximum * 100;
          const x = 27 + index * 66;
          return <g key={`${month.year}-${month.month}`}>
            <title>{month.label} {month.year}: {month.count} new users</title>
            <motion.rect x={x} width="32" rx="5"
              initial={reducedMotion ? false : { y: 125, height: 0 }} animate={{ y: 125 - height, height }}
              transition={{ duration: reducedMotion ? 0 : 0.55, ease: 'easeOut', delay: reducedMotion ? 0 : index * 0.06 }} fill="currentColor" className={index === months.length - 1 ? 'text-primary' : 'text-primary/45'} />
            <text x={x + 16} y={115 - height} textAnchor="middle" fill="currentColor" className="text-[16px] font-semibold text-foreground">{month.count}</text>
            <text x={x + 16} y="150" textAnchor="middle" fill="currentColor" className="text-[16px] text-default-400">{month.label}</text>
          </g>;
        })}
      </svg>
      <p className="mt-auto pt-1 text-[10px] leading-4 text-default-400">{months[0].label} {months[0].year} – {months[5].label} {months[5].year} · Monthly signups{missingDates > 0 ? ` · ${missingDates} without a valid join date excluded from the chart` : ''}</p>
    </CardBody></Card>
  </motion.div>;
}
