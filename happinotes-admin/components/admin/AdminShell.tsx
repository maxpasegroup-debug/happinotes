'use client';

import { useAdminConfirmation, useAdminConfirmationOpen } from "@/components/admin/ConfirmationProvider";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { Avatar, BreadcrumbItem, Breadcrumbs, Button, Chip, Divider, Drawer, DrawerBody, DrawerContent, DrawerHeader } from '@heroui/react';
import { AdminInstallButton } from './AdminPwaProvider';

// Animate the actual panel, whose width is smaller than the overlay on mobile.
// Using motion.section also loads the animation features before the first open.
const MobileDrawerPanel = forwardRef<HTMLElement, HTMLMotionProps<'section'>>(function MobileDrawerPanel(props, ref) {
  const reducedMotion = useReducedMotion();
  return <motion.section {...props} ref={ref}
    initial={reducedMotion ? false : { x: '-100%' }}
    animate={{ x: 0 }}
    exit={{ x: reducedMotion ? 0 : '-100%' }}
    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 38, mass: 0.8 }}
  />;
});

const menu = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', group: 'Workspace' },
  { label: 'Happy Bites', href: '/admin/happy-bites', icon: 'audio', group: 'Content management' },
  { label: 'Featured', href: '/admin/featured', icon: 'star', group: 'Content management' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings', group: 'Management' },
  { label: 'Deletion requests', href: '/admin/deletion-requests', icon: 'shield', group: 'Management' },
];
const paths: Record<string, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  audio: 'M5 10v4 M9 6v12 M13 3v18 M17 7v10 M21 10v4',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  settings: 'M4 7h16 M4 17h16 M9 4v6 M16 14v6',
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z M9 12l2 2 4-4',
  logout: 'M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  collapse: 'M3 4h18v16H3z M9 4v16 M16 9l-3 3 3 3',
};
function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.audio} /></svg>;
}
function Brand() {
  return <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/10"><Icon name="audio" /></div><div><p className="text-lg font-bold tracking-tight">HappiNotes</p><p className="text-[10px] font-medium uppercase tracking-[.2em] text-default-400">Admin workspace</p></div></div>;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const confirm = useAdminConfirmation();
  const confirming = useAdminConfirmationOpen();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeMobileMenu = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeMobileMenu);
    return () => desktop.removeEventListener('change', closeMobileMenu);
  }, []);
  const reducedMotion = useReducedMotion();
  const sidebarTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 36, mass: 0.8 };
  const current = menu.find((item) => pathname === item.href)?.label ?? (pathname.includes('/content/') ? 'Book editor' : 'Workspace');
  const logout = async () => {
    if (!await confirm({ title: 'Log out of admin?', description: 'End your admin session? Save any changes before logging out.', confirmLabel: 'Log out', tone: 'warning' })) return;
    window.localStorage.removeItem('admin_token');
    window.localStorage.removeItem('user_token');
    window.localStorage.removeItem('user_profile');
    router.replace('/admin/login');
  };
  const navigation = <nav aria-label="Admin navigation" className="space-y-7">
    {['Workspace', 'Content management', 'Management'].map((group) => <div key={group}><p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-default-400">{group}</p><div className="space-y-1">{menu.filter((item) => item.group === group).map((item) => {
      const active = pathname === item.href;
      return <Button key={item.href} as={Link} href={item.href} onPress={() => setMenuOpen(false)} aria-current={active ? 'page' : undefined} fullWidth startContent={<Icon name={item.icon} />} variant={active ? 'flat' : 'light'} color={active ? 'primary' : 'default'} className={`h-11 justify-start gap-3 rounded-xl px-3 text-sm font-medium ${active ? 'bg-primary/10 text-primary' : 'text-default-500'}`}>{item.label}</Button>;
    })}</div></div>)}
  </nav>;
  return <div className="min-h-screen lg:flex">
    <motion.aside
      id="admin-desktop-sidebar"
      initial={false}
      animate={{ width: sidebarOpen ? 248 : 0 }}
      transition={sidebarTransition}
      inert={!sidebarOpen}
      aria-hidden={!sidebarOpen}
      className="sticky top-0 hidden h-screen shrink-0 overflow-hidden lg:block"
    >
      <motion.div
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -32, opacity: sidebarOpen ? 1 : 0 }}
        transition={sidebarTransition}
        className="flex h-full w-[248px] flex-col border-r border-divider bg-content1/60 p-5"
      >
      <div className="px-2 py-3"><Brand /></div><Divider className="my-6" />
      <div className="flex-1 overflow-y-auto">{navigation}</div>
      <Divider className="my-4" />
      <div className="mb-4 flex items-center gap-3 px-2"><Avatar name="A" size="sm" className="bg-content3 text-default-500" /><div><p className="text-sm font-medium">Administrator</p><p className="text-xs text-default-400">Content & community</p></div></div>
      <Button onPress={logout} startContent={<Icon name="logout" />} variant="light" color="danger" className="justify-start">Log out</Button>
      </motion.div>
    </motion.aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-4 border-b border-divider bg-background/90 px-5 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="light" className="lg:hidden" aria-label="Open navigation" aria-controls={menuOpen && !confirming ? 'admin-mobile-sidebar' : undefined} aria-expanded={menuOpen && !confirming} onPress={() => setMenuOpen(true)}><Icon name="menu" /></Button>
          <Button isIconOnly variant="light" className="hidden lg:inline-flex" aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarOpen} aria-controls="admin-desktop-sidebar" onPress={() => setSidebarOpen((open) => !open)}><Icon name={sidebarOpen ? 'collapse' : 'menu'} /></Button>
          <Breadcrumbs size="sm"><BreadcrumbItem href="/admin/dashboard">Admin</BreadcrumbItem><BreadcrumbItem>{current}</BreadcrumbItem></Breadcrumbs>
        </div>
        <div className="flex shrink-0 items-center gap-3"><AdminInstallButton /><Chip size="sm" variant="flat" className="hidden border border-divider text-default-400 sm:inline-flex">HappiNotes Studio</Chip></div>
      </header>
      <main className="mx-auto min-w-0 max-w-[1600px] p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
    <Drawer
      disableAnimation={Boolean(reducedMotion) || confirming}
      isOpen={menuOpen && !confirming}
      onOpenChange={setMenuOpen}
      placement="left"
      size="xs"
      motionProps={{ initial: false, animate: { x: 0 }, exit: { x: 0 }, transition: { duration: 0 } }}
      classNames={{ base: 'dark admin-ui admin-mobile-drawer bg-content1 text-foreground', wrapper: 'overflow-hidden' }}
    >
      <DrawerContent as={MobileDrawerPanel} id="admin-mobile-sidebar" aria-label="Admin navigation"><DrawerHeader className="admin-mobile-drawer-header px-6 pt-8"><Brand /></DrawerHeader><DrawerBody className="admin-mobile-drawer-body p-6">{navigation}<Divider className="my-4" /><Button onPress={logout} startContent={<Icon name="logout" />} color="danger" variant="flat">Log out</Button></DrawerBody></DrawerContent>
    </Drawer>
  </div>;
}
