'use client';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { createConfirmationController, type ConfirmationOptions } from '@/lib/admin-confirmation';

const ConfirmationContext = createContext<((options: ConfirmationOptions) => Promise<boolean>) | null>(null);
const ConfirmationOpenContext = createContext(false);
const serverSnapshot = () => null;

export function useAdminConfirmationOpen() {
  return useContext(ConfirmationOpenContext);
}

export function useAdminConfirmation() {
  const confirm = useContext(ConfirmationContext);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const request = useCallback(async (options: ConfirmationOptions) => {
    if (!confirm || !mounted.current) return false;
    const accepted = await confirm(options);
    return mounted.current && accepted;
  }, [confirm]);
  if (!confirm) throw new Error('Admin confirmations require ConfirmationProvider.');
  return request;
}

export default function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(createConfirmationController);
  const decision = useSyncExternalStore(controller.subscribe, controller.getSnapshot, serverSnapshot);
  const pathname = usePathname();
  // Leaving the current screen or unmounting always cancels a pending action.
  useEffect(() => () => controller.cancel(), [controller, pathname]);
  const settle = (accepted: boolean) => { if (decision) controller.settle(decision.id, accepted); };

  return <ConfirmationContext.Provider value={controller.request}>
    <ConfirmationOpenContext.Provider value={Boolean(decision?.isOpen)}>{children}</ConfirmationOpenContext.Provider>
    <Modal key={decision?.id ?? 'empty'} isOpen={Boolean(decision?.isOpen)} onClose={() => settle(false)} isDismissable={false} backdrop="opaque" placement="center" scrollBehavior="inside" disableAnimation
      classNames={{ base: 'dark admin-ui admin-modal-panel border border-divider bg-content1 text-foreground', wrapper: 'admin-modal-wrapper admin-confirm-wrapper', backdrop: 'admin-modal-backdrop admin-confirm-backdrop' }}>
      <ModalContent>
        <ModalHeader className="gap-3 pt-6">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${decision?.tone === 'danger' ? 'bg-danger/10 text-danger' : decision?.tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></svg>
          </span><span className="self-center">{decision?.title}</span>
        </ModalHeader>
        <ModalBody><p className="whitespace-pre-line break-words text-sm leading-6 text-default-400">{decision?.description}</p></ModalBody>
        <ModalFooter className="gap-3 pb-6">
          <Button autoFocus type="button" variant="flat" onPress={() => settle(false)}>Cancel</Button>
          <Button type="button" color={decision?.tone ?? 'primary'} onPress={() => settle(true)}>{decision?.confirmLabel ?? 'Confirm'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </ConfirmationContext.Provider>;
}
