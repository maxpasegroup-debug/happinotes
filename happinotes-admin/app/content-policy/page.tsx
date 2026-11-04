import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";
export const metadata: Metadata = { title: "Content and Copyright | HappiNotes", description: "Content rights and complaint contact for HappiNotes." };
export default function ContentPolicyPage() { return <LegalDocument fileName="INTELLECTUAL_PROPERTY_AND_CONTENT_POLICY.md" title="Content and Copyright Policy" description="Content rights and how to raise a complaint." />; }
