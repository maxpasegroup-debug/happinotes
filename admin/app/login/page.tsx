'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok || !data.success) {
      setError(data.message || 'Login failed');
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <main style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', padding: 24 }}>
      <form className="card form" onSubmit={submit} style={{ width: '100%', maxWidth: 420 }}>
        <div>
          <div className="brand">HappiNotes</div>
          <h1 className="title">Admin Login</h1>
        </div>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="button" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}
