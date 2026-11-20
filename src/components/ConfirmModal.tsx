import React from 'react';
import { ModalPortal } from './ModalPortal';
import './ConfirmModal.css';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="confirm-modal-backdrop"
        onClick={() => !isLoading && onCancel()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div
          className="confirm-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h3>
          <p className="confirm-modal-message">{message}</p>
          <div className="confirm-modal-actions">
            <button
              type="button"
              className="confirm-modal-btn confirm-modal-btn-cancel"
              disabled={isLoading}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`confirm-modal-btn ${
                isDestructive
                  ? 'confirm-modal-btn-destructive'
                  : 'confirm-modal-btn-primary'
              }`}
              disabled={isLoading}
              onClick={onConfirm}
            >
              {isLoading ? (loadingLabel || `${confirmLabel}...`) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
