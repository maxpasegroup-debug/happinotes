import { UsersChart } from '@/components/UsersChart';
import { serverApi } from '@/lib/server-api';
type StatsResponse = {
  success: boolean;
  stats: {
    totalUsers: number;
    activePremiumSubscribers: number;
    totalBooksPublished: number;
    totalChaptersUploaded: number;
    mostListenedBook: string;
  };
  usersPerWeek: Array<{ week: string; users: number }>;
};

export default async function DashboardPage() {
  const data = await serverApi<StatsResponse>('/admin/stats');
  const stats = [
    ['Total Users', data.stats.totalUsers],
    ['Premium Subscribers', data.stats.activePremiumSubscribers],
    ['Books Published', data.stats.totalBooksPublished],
    ['Chapters Uploaded', data.stats.totalChaptersUploaded],
    ['Most Listened', data.stats.mostListenedBook],
  ];

  return (
    <>
      <div className="page-head">
        <h1 className="title">Dashboard</h1>
      </div>
      <section className="grid stats">
        {stats.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </section>
      <section className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
        <div className="card">
          <h2>New Users Per Week</h2>
          <UsersChart data={data.usersPerWeek} />
        </div>
        <div className="card">
          <h2>Subscription access</h2>
          <p>Premium access is granted after Apple or Google purchase verification by the backend.</p>
          <p>Users manage renewal and cancellation through their app store account.</p>
        </div>
      </section>
    </>
  );
}
