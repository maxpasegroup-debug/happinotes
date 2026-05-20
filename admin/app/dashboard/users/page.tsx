import { UserActions } from '@/components/UserActions';
import { serverApi } from '@/lib/server-api';
import type { User } from '@/lib/types';

type UsersResponse = { success: boolean; users: User[] };

export default async function UsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const data = await serverApi<UsersResponse>('/admin/users');
  const query = (searchParams.q || '').toLowerCase();
  const users = data.users.filter((user) =>
    !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
  );

  return (
    <>
      <div className="page-head"><h1 className="title">Users</h1></div>
      <form className="actions" style={{ marginBottom: 16 }}>
        <input name="q" defaultValue={searchParams.q || ''} placeholder="Search name or email" />
        <button className="button secondary">Search</button>
      </form>
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td><span className="badge">{user.subscriptionStatus}</span></td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td><UserActions user={user} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
