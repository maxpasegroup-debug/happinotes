import type { ReactNode } from 'react';
import AdminProvider from '@/components/admin/AdminProvider';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
