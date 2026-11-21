'use client';

import { HeroUIProvider, Switch, ToastProvider } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import ConfirmationProvider from './ConfirmationProvider';
import AdminActionTooltips from './AdminActionTooltips';
import AdminPwaProvider from './AdminPwaProvider';

const preferenceKey = 'happinotes.admin.appearance';
const legacyKey = 'happinotes.admin.user-security.appearance';
type Mode = 'dark' | 'light';
const AdminAppearance = createContext<{ mode: Mode; select: (mode: Mode) => void } | null>(null);

export function AdminThemeSwitch({ grouped = false }: { grouped?: boolean }) {
  const appearance = useContext(AdminAppearance);
  if (!appearance) throw new Error('Appearance controls require the admin workspace.');
  const { mode, select } = appearance;
  return <Switch size="sm" color="primary" aria-label="Dark mode" isSelected={mode === 'dark'}
        onValueChange={selected => select(selected ? 'dark' : 'light')}
        classNames={{ base: grouped ? 'm-0 h-9 gap-1.5 rounded-none px-2 hover:bg-primary/10 sm:px-3' : 'm-0 min-h-11 gap-1.5 px-1 sm:px-2', wrapper: 'mr-0', label: 'hidden text-xs font-semibold sm:inline' }}
        thumbIcon={({ isSelected, className }) => <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {isSelected ? <path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
        </svg>}>Dark mode</Switch>;
}

export default function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [mode, setPreference] = useState<Mode>('dark');
  useEffect(() => {
    const read = () => {
      try { setPreference((localStorage.getItem(preferenceKey) ?? localStorage.getItem(legacyKey)) === 'light' ? 'light' : 'dark'); }
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
  return <AdminAppearance.Provider value={{ mode, select }}><HeroUIProvider navigate={router.push} disableAnimation={Boolean(reducedMotion)}>
    <AdminActionTooltips />
    <ToastProvider placement="bottom-right" toastOffset={24} maxVisibleToasts={4} />
    <AdminPwaProvider><ConfirmationProvider><div className={`${mode} admin-ui min-h-screen bg-background text-foreground`}>{children}</div></ConfirmationProvider></AdminPwaProvider>
  </HeroUIProvider></AdminAppearance.Provider>;
}
