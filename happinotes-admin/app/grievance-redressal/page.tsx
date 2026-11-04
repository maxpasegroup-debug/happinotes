import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";
export const metadata: Metadata = { title: "Grievance and Privacy Complaints | HappiNotes", description: "Contact HappiNotes about a complaint or privacy request." };
export default function GrievancePage() { return <LegalDocument fileName="GRIEVANCE_AND_PRIVACY_COMPLAINT_POLICY.md" title="Grievance and Privacy Complaints" description="How to contact HappiNotes about a complaint or privacy request." />; }
