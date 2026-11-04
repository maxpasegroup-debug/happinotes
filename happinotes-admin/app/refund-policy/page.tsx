import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";
export const metadata: Metadata = { title: "Refund Policy | HappiNotes", description: "Refund handling for HappiNotes store purchases." };
export default function RefundPolicyPage() { return <LegalDocument fileName="REFUND_POLICY.md" title="Refund Policy" description="How to request a refund for a store purchase." />; }
