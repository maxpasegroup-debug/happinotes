'use client';

import { HeroUIProvider } from '@heroui/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import ConfirmationProvider from './ConfirmationProvider';
import AdminPwaProvider from './AdminPwaProvider';

export default function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  return <HeroUIProvider navigate={router.push} disableAnimation={Boolean(reducedMotion)}>
    <AdminPwaProvider><ConfirmationProvider><div className="dark admin-ui min-h-screen bg-background text-foreground">{children}</div></ConfirmationProvider></AdminPwaProvider>
  </HeroUIProvider>;
}
