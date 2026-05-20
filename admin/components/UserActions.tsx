'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import type { Payment, User } from '@/lib/types';

export function UserActions({ user, payments }: { user: User; payments?: Payment[] }) {
  const router = useRouter();
  const [expiry, setExpiry] = useState(user.subscriptionExpiry?.slice(0, 10) || '');

  async function subscription(status: 'free' | 'premium' | 'lifetime') {
    await clientApi(`/admin/users/${user._id}/subscription`, {
      method: 'PUT',
      body: JSON.stringify({ subscriptionStatus: status, subscriptionExpiry: status === 'premium' ? expiry : null }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${user.email}?`)) return;
    await clientApi(`/admin/users/${user._id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <details>
      <summary className="button secondary">Details</summary>
      <div className="card" style={{ marginTop: 10 }}>
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Plan:</strong> {user.subscriptionStatus}</p>
        <div className="actions">
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <button className="button secondary" onClick={() => subscription('premium')}>Grant Premium</button>
          <button className="button secondary" onClick={() => subscription('lifetime')}>Grant Lifetime</button>
          <button className="button secondary" onClick={() => subscription('free')}>Revoke Premium</button>
          <button className="button danger" onClick={remove}>Delete User</button>
        </div>
        {payments?.length ? <p className="muted">{payments.length} payments found.</p> : null}
      </div>
    </details>
  );
}
