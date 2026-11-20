'use client';

import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import ConfirmationProvider from './ConfirmationProvider';
import AdminPwaProvider from './AdminPwaProvider';

const preferenceKey = 'happinotes.admin.user-security.appearance';
type Mode = 'dark' | 'light';
const SecurityAppearance = createContext<{ mode: Mode; select: (mode: Mode) => void } | null>(null);

export function useSecurityAppearance() {
  const appearance = useContext(SecurityAppearance);
  if (!appearance) throw new Error('Appearance controls require the admin workspace.');
  return appearance;
}

export default function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const [preference, setPreference] = useState<Mode>('dark');
  const mode = pathname === '/admin/user-security' ? preference : 'dark';
  useEffect(() => {
    const read = () => {
      try { setPreference(localStorage.getItem(preferenceKey) === 'light' ? 'light' : 'dark'); }
      catch { /* The switch still works for this visit when storage is disabled. */ }
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === preferenceKey || event.key === null) read(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useLayoutEffect(() => {
    // HeroUI puts dialogs, tooltips and toasts outside the page wrapper.
    const body = document.body;
    const previous = { light: body.classList.contains('light'), dark: body.classList.contains('dark') };
    body.classList.toggle('light', mode === 'light');
    body.classList.toggle('dark', mode === 'dark');
    return () => {
      body.classList.toggle('light', previous.light);
      body.classList.toggle('dark', previous.dark);
    };
  }, [mode]);
  function select(next: Mode) {
    setPreference(next);
    try { localStorage.setItem(preferenceKey, next); } catch { /* In-memory preference remains usable. */ }
  }
  return <SecurityAppearance.Provider value={{ mode, select }}><HeroUIProvider navigate={router.push} disableAnimation={Boolean(reducedMotion)}>
    <ToastProvider placement="bottom-right" toastOffset={24} maxVisibleToasts={4} />
    <AdminPwaProvider><ConfirmationProvider><div className={`${mode} admin-ui min-h-screen bg-background text-foreground`}>{children}</div></ConfirmationProvider></AdminPwaProvider>
  </HeroUIProvider></SecurityAppearance.Provider>;
}
