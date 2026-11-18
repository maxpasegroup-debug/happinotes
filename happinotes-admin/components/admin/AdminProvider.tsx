'use client';

import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import ConfirmationProvider from './ConfirmationProvider';
import AdminPwaProvider from './AdminPwaProvider';

export default function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  return <HeroUIProvider navigate={router.push} disableAnimation={Boolean(reducedMotion)}>
    <ToastProvider placement="bottom-right" toastOffset={24} maxVisibleToasts={4} />
    <AdminPwaProvider><ConfirmationProvider><div className="dark admin-ui min-h-screen bg-background text-foreground">{children}</div></ConfirmationProvider></AdminPwaProvider>
  </HeroUIProvider>;
}
