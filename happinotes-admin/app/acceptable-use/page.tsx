import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";
export const metadata: Metadata = { title: "Acceptable Use | HappiNotes", description: "Rules for using HappiNotes." };
export default function AcceptableUsePage() { return <LegalDocument fileName="ACCEPTABLE_USE_POLICY.md" title="Acceptable Use Policy" description="Rules for using HappiNotes and its content." />; }
