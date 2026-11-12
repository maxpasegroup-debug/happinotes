'use client';

import { Modal, type ModalProps } from '@heroui/react';
import { useAdminConfirmationOpen } from './ConfirmationProvider';

/** Keep only one active focus trap when an editor opens a confirmation. */
export default function AdminModal({ isOpen, classNames, children, ...props }: ModalProps) {
  const confirming = useAdminConfirmationOpen();
  return <Modal {...props} isOpen={Boolean(isOpen) && !confirming} disableAnimation placement="center"
    classNames={{
      ...classNames,
      wrapper: `admin-modal-wrapper ${classNames?.wrapper ?? ''}`,
      backdrop: `admin-modal-backdrop ${classNames?.backdrop ?? ''}`,
      base: `admin-modal-panel ${classNames?.base ?? ''}`,
    }}>{children}</Modal>;
}
