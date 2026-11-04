import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

export const metadata: Metadata = { title: "Privacy Policy | HappiNotes", description: "HappiNotes privacy policy draft." };
export default function PrivacyPolicyPage() {
  return <LegalDocument fileName="FINAL_PRIVACY_POLICY.md" title="Privacy Policy" description="How HappiNotes handles account, app, and subscription information." />;
}
