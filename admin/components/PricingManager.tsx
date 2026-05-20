'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientApi } from '@/lib/client-api';
import type { Offer, Payment } from '@/lib/types';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
};

export function PricingManager({ plans, offers, payments }: { plans: Plan[]; offers: Offer[]; payments: Payment[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: '',
    discountPercent: 10,
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    appliesToPlan: 'all',
    isActive: true,
  });
  const [error, setError] = useState('');

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await clientApi('/admin/offers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offer save failed');
    }
  }

  async function toggle(offer: Offer) {
    await clientApi(`/admin/offers/${offer._id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...offer, isActive: !offer.isActive }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete offer?')) return;
    await clientApi(`/admin/offers/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="grid">
      <section className="grid stats">
        {plans.map((plan) => (
          <div className="card" key={plan.id}>
            <div className="stat-label">{plan.name}</div>
            <div className="stat-value">INR {plan.price}</div>
            <p className="muted">{plan.durationDays} days</p>
          </div>
        ))}
      </section>
      <form className="card form" onSubmit={create}>
        <h2>Create Offer</h2>
        <div className="split">
          <div className="field"><label>Coupon Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="field"><label>Discount Percent</label><input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} /></div>
        </div>
        <div className="split">
          <div className="field"><label>Valid From</label><input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></div>
          <div className="field"><label>Valid Until</label><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
        </div>
        <div className="field"><label>Applies To</label><select value={form.appliesToPlan} onChange={(e) => setForm({ ...form, appliesToPlan: e.target.value })}><option value="all">All</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="lifetime">Lifetime</option></select></div>
        <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        {error ? <p className="error">{error}</p> : null}
        <button className="button">Create Offer</button>
      </form>
      <section className="card">
        <h2>Offers</h2>
        <table className="table">
          <thead><tr><th>Code</th><th>Discount</th><th>Plan</th><th>Window</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{offers.map((offer) => (
            <tr key={offer._id}>
              <td>{offer.code || '-'}</td>
              <td>{offer.discountPercent}%</td>
              <td>{offer.appliesToPlan}</td>
              <td>{new Date(offer.validFrom).toLocaleDateString()} - {new Date(offer.validUntil).toLocaleDateString()}</td>
              <td><span className="badge">{offer.isActive ? 'active' : 'inactive'}</span></td>
              <td className="actions"><button className="button secondary" onClick={() => toggle(offer)}>Toggle</button><button className="button danger" onClick={() => remove(offer._id)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card">
        <h2>Payments</h2>
        <table className="table">
          <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{payments.map((payment) => (
            <tr key={payment._id}><td>{payment.userId?.email || '-'}</td><td>{payment.planId}</td><td>INR {payment.amountINR}</td><td>{payment.status}</td><td>{new Date(payment.createdAt).toLocaleDateString()}</td></tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
