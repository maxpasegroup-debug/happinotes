export type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'warning' | 'danger';
};

/** A single pending decision; duplicate requests never execute another action. */
export function createConfirmationController() {
  let current: (ConfirmationOptions & { id: number; isOpen: boolean }) | null = null;
  let nextId = 0;
  let resolve: ((accepted: boolean) => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const settle = (id: number, accepted: boolean) => {
    if (!resolve || current?.id !== id) return;
    const done = resolve;
    resolve = null;
    current = { ...current, isOpen: false };
    notify();
    done(accepted);
  };
  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request: (options: ConfirmationOptions): Promise<boolean> => {
      if (resolve) return Promise.resolve(false);
      return new Promise((done) => { resolve = done; current = { ...options, id: ++nextId, isOpen: true }; notify(); });
    },
    settle,
    cancel: () => { if (current) settle(current.id, false); },
  };
}
