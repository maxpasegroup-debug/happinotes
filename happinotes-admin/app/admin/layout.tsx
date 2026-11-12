import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import AdminProvider from '@/components/admin/AdminProvider';

export const metadata: Metadata = {
  title: 'HappiNotes Admin',
  description: 'Manage HappiNotes books, Happy Bites and your community.',
  applicationName: 'HappiNotes Admin',
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'HappiNotes Admin', statusBarStyle: 'black-translucent' },
  icons: {
    icon: '/admin/icons/icon-192.png',
    apple: '/admin/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F27055',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
