import { PricingManager } from '@/components/PricingManager';
import { serverApi } from '@/lib/server-api';
import type { Offer, Payment } from '@/lib/types';

type PlansResponse = { success: boolean; plans: Array<{ id: string; name: string; price: number; durationDays: number }> };
type OffersResponse = { success: boolean; offers: Offer[] };
type PaymentsResponse = { success: boolean; payments: Payment[] };

export default async function PricingPage() {
  const [plans, offers, payments] = await Promise.all([
    serverApi<PlansResponse>('/payments/plans'),
    serverApi<OffersResponse>('/admin/offers'),
    serverApi<PaymentsResponse>('/admin/payments'),
  ]);

  return (
    <>
      <div className="page-head"><h1 className="title">Pricing</h1></div>
      <PricingManager plans={plans.plans} offers={offers.offers} payments={payments.payments} />
    </>
  );
}
