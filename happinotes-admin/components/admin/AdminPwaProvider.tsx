'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
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

const InstallContext = createContext({ available: false, ios: false, installing: false, install: async () => {} });

export default function AdminPwaProvider({ children }: { children: ReactNode }) {
  const environment = useSyncExternalStore(subscribeToDisplayMode, getInstallEnvironment, getServerEnvironment);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Keep development HMR and local debugging outside service-worker control.
    if (process.env.NODE_ENV !== 'production' || !window.isSecureContext) return;
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
  }, []);

  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } finally { setPrompt(null); setInstalling(false); }
  };

  const canInstall = process.env.NODE_ENV === 'production' && !installed && environment !== 'installed';
  return <InstallContext.Provider value={{ available: canInstall && Boolean(prompt), ios: canInstall && environment === 'ios', installing, install }}>{children}</InstallContext.Provider>;
}

export function AdminInstallButton() {
  const { available, ios, installing, install } = useContext(InstallContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState('');
  if (!available && !ios && !error) return null;
  return <>
    {(available || ios) && <Button size="sm" color="primary" variant="flat" isLoading={installing} aria-label="Install HappiNotes Admin" onPress={async () => {
      setError('');
      if (ios) { setHelpOpen(true); return; }
      try { await install(); } catch { setError('Use your browser menu to install the admin app.'); }
    }}>Install app</Button>}
    {error && <span role="status" className="max-w-40 text-xs text-default-400">{error}</span>}
    <Modal isOpen={helpOpen} onClose={() => setHelpOpen(false)} placement="center" disableAnimation
      classNames={{ base: 'dark admin-ui admin-modal-panel border border-divider bg-content1 text-foreground', wrapper: 'admin-modal-wrapper', backdrop: 'admin-modal-backdrop' }}>
      <ModalContent><ModalHeader>Install HappiNotes Admin</ModalHeader><ModalBody>
        <p className="text-sm leading-6 text-default-400">Open this admin page in Safari, tap Share, then choose Add to Home Screen. If prompted, keep Open as Web App enabled and tap Add.</p>
      </ModalBody><ModalFooter><Button color="primary" onPress={() => setHelpOpen(false)}>Got it</Button></ModalFooter></ModalContent>
    </Modal>
  </>;
}
