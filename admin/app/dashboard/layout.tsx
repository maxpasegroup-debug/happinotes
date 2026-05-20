import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/books', label: 'Books' },
  { href: '/dashboard/books/create', label: 'Create Book' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/pricing', label: 'Pricing' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">HappiNotes</div>
        <nav className="nav">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>{link.label}</Link>
          ))}
          <LogoutButton />
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
