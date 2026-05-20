import { UsersChart } from '@/components/UsersChart';
import { serverApi } from '@/lib/server-api';
import type { Payment } from '@/lib/types';

type StatsResponse = {
  success: boolean;
  stats: {
    totalUsers: number;
    activePremiumSubscribers: number;
    revenueThisMonth: number;
    totalBooksPublished: number;
    totalChaptersUploaded: number;
    mostListenedBook: string;
  };
  usersPerWeek: Array<{ week: string; users: number }>;
  recentPayments: Payment[];
};

export default async function DashboardPage() {
  const data = await serverApi<StatsResponse>('/admin/stats');
  const stats = [
    ['Total Users', data.stats.totalUsers],
    ['Premium Subscribers', data.stats.activePremiumSubscribers],
    ['Revenue This Month', `INR ${data.stats.revenueThisMonth}`],
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
          <h2>Recent Payments</h2>
          <table className="table">
            <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentPayments.map((payment) => (
                <tr key={payment._id}>
                  <td>{payment.userId?.email || 'Unknown'}</td>
                  <td>{payment.planId}</td>
                  <td>INR {payment.amountINR}</td>
                  <td><span className="badge">{payment.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
