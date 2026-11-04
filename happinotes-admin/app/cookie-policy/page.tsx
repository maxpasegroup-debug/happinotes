import type { Metadata } from "next";
import { LegalDocument } from "../legal-document";
export const metadata: Metadata = { title: "Cookies and Storage | HappiNotes", description: "Browser storage and similar technologies used by HappiNotes." };
export default function CookiePolicyPage() { return <LegalDocument fileName="COOKIE_POLICY.md" title="Cookies and Similar Technologies" description="Browser storage and similar technologies in the reviewed source." />; }
