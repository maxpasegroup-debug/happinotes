import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy | HappiNotes",
  description: "How HappiNotes handles account, app, purchase and privacy-request information.",
  alternates: { canonical: "https://happinotes.online/privacy-policy" },
};
export default function PrivacyPolicyPage() {
  return <LegalDocument fileName="FINAL_PRIVACY_POLICY.md" title="Privacy Policy" description="How HappiNotes handles account, app, purchase and privacy-request information." showDraftNotice={false} />;
}
