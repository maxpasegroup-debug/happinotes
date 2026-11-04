import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";

export const metadata: Metadata = { title: "Terms and Conditions | HappiNotes", description: "HappiNotes terms and conditions draft." };
export default function TermsPage() {
  return <LegalDocument fileName="FINAL_TERMS_AND_CONDITIONS.md" title="Terms and Conditions" description="Terms for use of HappiNotes and its content." />;
}
