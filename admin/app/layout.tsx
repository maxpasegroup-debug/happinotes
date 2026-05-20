import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HappiNotes Admin',
  description: 'Admin panel for HappiNotes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
