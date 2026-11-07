import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

type Props = { fileName: string; title: string; description: string; showDraftNotice?: boolean };

function inline(text: string, keyPrefix: string) {
  const pieces = text.split(/(\*\*.*?\*\*|\[[^\]]+\]\([^)]+\))/g);
  return pieces.map((piece, index) => {
    const key = `${keyPrefix}-${index}`;
    const link = piece.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={key} href={link[2]}>{link[1]}</Link>;
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={key}>{piece.slice(2, -2)}</strong>;
    return piece;
  });
}

export function LegalDocument({ fileName, title, description, showDraftNotice = true }: Props) {
  const markdown = readFileSync(path.join(process.cwd(), "legal-documents", fileName), "utf8");
  const lines = markdown.split(/\r?\n/);
  const content = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    if (line.startsWith("# ")) {
      content.push(<h1 key={index}>{line.slice(2)}</h1>); index += 1; continue;
    }
    if (line.startsWith("## ")) {
      content.push(<h2 key={index}>{line.slice(3)}</h2>); index += 1; continue;
    }
    if (line.startsWith("- ") || /^\d+\. /.test(line)) {
      const items = [];
      while (index < lines.length && (/^\s*- /.test(lines[index]) || /^\s*\d+\. /.test(lines[index]))) {
        items.push(<li key={index}>{inline(lines[index].trim().replace(/^(?:- |\d+\. )/, ""), `li-${index}`)}</li>);
        index += 1;
      }
      content.push(<ul key={`list-${index}`}>{items}</ul>); continue;
    }
    content.push(<p key={index}>{inline(line, `p-${index}`)}</p>); index += 1;
  }

  return <main className="legal-page">
    <nav className="legal-nav"><Link href="/">HappiNotes</Link><span>Legal information</span></nav>
    <article className="legal-card">
      <p className="legal-operator">HappiNotes is owned and operated by <strong>AIRASKILL CITY PRIVATE LIMITED</strong>.</p>
      <address className="legal-contact">Registered office: 2619, T2, 6th Floor, HiLITE Business Park, HiLITE City, near Guruvayurappan College, Kozhikode – 673014, Kerala, India.<br />Customer support and privacy: <a href="mailto:hello@happinotes.online">hello@happinotes.online</a> · <a href="tel:+918089239823">+91 8089239823</a></address>
      {showDraftNotice && <p className="legal-draft">Draft — owner and legal review required before publication</p>}
      <h1 className="legal-page-title">{title}</h1>
      <p className="legal-description">{description}</p>
      <div className="legal-content">{content}</div>
      <footer className="legal-footer"><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/subscription-policy">Subscriptions</Link><Link href="/refund-policy">Refunds</Link><Link href="/cookie-policy">Cookies</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/content-policy">Content</Link><Link href="/grievance-redressal">Grievances</Link><Link href="/account-deletion">Account deletion</Link></footer>
    </article>
  </main>;
}
