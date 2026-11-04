import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

export const metadata: Metadata = { title: "Subscription Policy | HappiNotes", description: "HappiNotes subscription, cancellation, and refund policy draft." };
export default function SubscriptionPolicyPage() {
  return <LegalDocument fileName="SUBSCRIPTION_CANCELLATION_REFUND_POLICY.md" title="Subscription, Cancellation and Refund Policy" description="Store billing, renewal, cancellation and refund information." />;
}
