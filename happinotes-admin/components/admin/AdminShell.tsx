'use client';

import { useAdminConfirmation, useAdminConfirmationOpen } from "@/components/admin/ConfirmationProvider";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { Avatar, BreadcrumbItem, Breadcrumbs, Button, Chip, Divider, Drawer, DrawerBody, DrawerContent, DrawerHeader } from '@heroui/react';
import { AdminInstallButton } from './AdminPwaProvider';
import AdminSleepScreen from './AdminSleepScreen';

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
  { label: 'Story Books', href: '/admin/story-books', icon: 'book', group: 'Content management' },
  { label: 'Happy Bites', href: '/admin/happy-bites', icon: 'audio', group: 'Content management' },
  { label: 'Featured', href: '/admin/featured', icon: 'star', group: 'Content management' },
  { label: 'Users', href: '/admin/users', icon: 'users', group: 'Management' },
  { label: 'User Security', href: '/admin/user-security', icon: 'shield', group: 'Management' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings', group: 'Management' },
  { label: 'System Status', href: '/admin/system-status', icon: 'status', group: 'Management' },
  { label: 'Deletion requests', href: '/admin/deletion-requests', icon: 'trash', group: 'Management' },
];
const paths: Record<string, string> = {
  sleep: 'M20.5 13.3A8.5 8.5 0 0 1 10.7 3.5 8.5 8.5 0 1 0 20.5 13.3Z',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  status: 'M3 12h4l3-8 4 16 3-8h4 M3 3h18 M3 21h18',
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  book: 'M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1Z M12 5v15',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
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
  const [sleeping, setSleeping] = useState(false);
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
      return <Button key={item.href} as={Link} href={item.href} onPress={() => setMenuOpen(false)} aria-current={active ? 'page' : undefined} fullWidth startContent={<Icon name={item.icon} />} variant={active ? 'flat' : 'light'} color={active ? 'primary' : 'default'} className={`h-11 justify-start gap-3 rounded-xl px-3 text-sm font-medium ${active ? 'bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm shadow-primary/5' : 'text-default-500 hover:text-foreground'}`}>{item.label}</Button>;
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
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button isIconOnly variant="light" className="lg:hidden" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={menuOpen && !confirming} onPress={() => setMenuOpen(true)}><Icon name="menu" /></Button>
          <Button isIconOnly variant="light" className="hidden lg:inline-flex" aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarOpen} aria-controls="admin-desktop-sidebar" onPress={() => setSidebarOpen((open) => !open)}><Icon name={sidebarOpen ? 'collapse' : 'menu'} /></Button>
          <Breadcrumbs size="sm" className="min-w-0" classNames={{ list: 'flex-nowrap overflow-hidden' }}><BreadcrumbItem href="/admin/dashboard">Admin</BreadcrumbItem><BreadcrumbItem>{current}</BreadcrumbItem></Breadcrumbs>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button variant="flat" size="sm" radius="full" startContent={<Icon name="sleep" />} isDisabled={confirming} aria-label="Put admin workspace to sleep" aria-haspopup="dialog" onPress={() => { setMenuOpen(false); setSleeping(true); }} className="min-w-10 border border-orange-400/15 bg-orange-500/10 px-2 text-orange-200 transition-colors hover:bg-orange-500/20 sm:px-3"><span className="hidden sm:inline">Sleep</span></Button>
          <AdminInstallButton /><Chip size="sm" variant="flat" className="hidden border border-divider text-default-400 sm:inline-flex">HappiNotes Studio</Chip></div>
      </header>
      <main className={`min-w-0 ${pathname === '/admin/users' ? 'w-full py-5 sm:py-8 lg:py-10' : `p-5 sm:p-8 lg:p-10 ${(pathname.startsWith('/admin/happy-bites') || pathname.startsWith('/admin/content/') || pathname === '/admin/story-books' || pathname === '/admin/settings' || pathname === '/admin/system-status') ? 'w-full' : 'mx-auto max-w-[1600px]'}`}`} >{children}</main>
    </div>
    <AdminSleepScreen isOpen={sleeping} onWake={() => setSleeping(false)} />
    <Drawer
      disableAnimation={Boolean(reducedMotion) || confirming}
      isOpen={menuOpen && !confirming}
      onOpenChange={setMenuOpen}
      placement="left"
      size="xs"
      motionProps={{ initial: false, animate: { x: 0 }, exit: { x: 0 }, transition: { duration: 0 } }}
      classNames={{ base: 'dark admin-ui admin-mobile-drawer bg-content1 text-foreground', wrapper: 'overflow-hidden' }}
    >
      <DrawerContent as={MobileDrawerPanel} aria-label="Admin navigation"><DrawerHeader className="admin-mobile-drawer-header px-6 pt-8"><Brand /></DrawerHeader><DrawerBody className="admin-mobile-drawer-body p-6">{navigation}<Divider className="my-4" /><Button onPress={logout} startContent={<Icon name="logout" />} color="danger" variant="flat">Log out</Button></DrawerBody></DrawerContent>
    </Drawer>
  </div>;
}
