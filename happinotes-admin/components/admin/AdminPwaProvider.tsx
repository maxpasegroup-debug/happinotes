'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress } from '@heroui/react';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function subscribeToDisplayMode(onChange: () => void) {
  const mode = window.matchMedia('(display-mode: standalone)');
  mode.addEventListener('change', onChange);
  return () => mode.removeEventListener('change', onChange);
}
function getInstallEnvironment() {
  if (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) return 'installed';
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'browser';
}
const getServerEnvironment = () => 'browser';

const InstallContext = createContext({ available: false, installed: false, ios: false, installing: false, install: async () => {} });

export default function AdminPwaProvider({ children }: { children: ReactNode }) {
  const environment = useSyncExternalStore(subscribeToDisplayMode, getInstallEnvironment, getServerEnvironment);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const localDevelopment = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const pwaEnabled = process.env.NODE_ENV === 'production' || localDevelopment;

  useEffect(() => {
    // Localhost is a secure browser context and is useful for verifying the
    // install flow without allowing a non-secure remote origin to register.
    if (!pwaEnabled || !window.isSecureContext) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/', updateViaCache: 'none' })
        .catch((error: unknown) => console.warn('Admin offline support could not start:', error));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [pwaEnabled]);

  const install = async () => {
    if (installing) return;
    if (!prompt) throw new Error('The browser install prompt is not available. Use the browser menu to install this admin app.');
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } finally { setPrompt(null); setInstalling(false); }
  };

  const isInstalled = installed || environment === 'installed';
  const canInstall = pwaEnabled && !isInstalled;
  return <InstallContext.Provider value={{ available: canInstall, installed: isInstalled, ios: canInstall && environment === 'ios', installing, install }}>{children}</InstallContext.Provider>;
}

export function AdminInstallButton() {
  const { available, installed, ios, installing, install } = useContext(InstallContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState('');
  if (!available && !installed && !ios && !error) return null;
  return <>
    {installing && <div role="status" aria-label="Installing HappiNotes Admin" className="flex h-9 min-w-[9.5rem] items-center gap-2 border-l border-primary/20 bg-primary/[.03] px-3"><Progress aria-label="Install progress" isIndeterminate color="primary" size="sm" radius="full" className="w-16" classNames={{ track: 'bg-primary/15', indicator: 'bg-primary' }} /><span className="whitespace-nowrap text-xs font-medium text-primary">Installing…</span></div>}
    {(available || ios || installed) && !installing && <Button size="sm" radius="none" aria-label={installed ? "Open HappiNotes Admin" : "Install HappiNotes Admin"} startContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{installed ? <><path d="M5 12h13m-5-4 4 4-4 4" /><path d="M5 5v14" /></> : <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>}</svg>} onPress={async () => {
      setError('');
      if (installed) { window.location.assign('/admin/dashboard'); return; }
      if (ios) { setHelpOpen(true); return; }
      try { await install(); } catch { setError('The browser install prompt is unavailable in this session.'); setHelpOpen(true); }
    }} className="h-9 min-w-0 border-l border-primary/20 bg-transparent px-3 text-xs font-semibold text-primary hover:bg-primary/10">{installed ? 'Open app' : 'Install app'}</Button>}
    {error && <span role="status" className="max-w-40 text-xs text-default-400">{error}</span>}
    <Modal isOpen={helpOpen} onClose={() => setHelpOpen(false)} placement="center" disableAnimation
      classNames={{ base: 'dark admin-ui admin-modal-panel border border-divider bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader>Install HappiNotes Admin</ModalHeader><ModalBody className="gap-4">
        {ios ? <p className="text-sm leading-6 text-default-400">Open this admin page in Safari, tap Share, then choose Add to Home Screen. If prompted, keep Open as Web App enabled and tap Add.</p> : <><p className="text-sm leading-6 text-default-400">This browser has not exposed its one-click install prompt yet.</p><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-default-400"><li>In Chrome or Edge, open the browser menu.</li><li>Choose <strong className="text-foreground">Install HappiNotes Admin</strong> or <strong className="text-foreground">Save and share → Install page as app</strong>.</li><li>Confirm the install dialog.</li></ol><p className="text-xs leading-5 text-default-500">If the install option is missing, reload this HTTPS page once and make sure the browser is not already running the admin as an installed app.</p></>}
      </ModalBody><ModalFooter><Button color="primary" onPress={() => setHelpOpen(false)}>Got it</Button></ModalFooter></ModalContent>
    </Modal>
  </>;
}
