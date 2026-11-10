import React, { useEffect } from 'react';
import { Sparkle } from './illustrations/Sparkle';
import './Toast.css';

export interface ToastProps {
  message?: string;
  visible: boolean;
  onClose?: () => void;
  durationMs?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message = 'Saved',
  visible,
  onClose,
  durationMs = 2000,
}) => {
  useEffect(() => {
    if (!visible || !onClose) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [visible, onClose, durationMs]);

  if (!visible) return null;

  return (
    <div className="toast-portal" role="status" aria-live="polite">
      <div className="toast-pill">
        <Sparkle size={14} color="var(--gold)" />
        <span className="toast-message">{message}</span>
      </div>
    </div>
  );
};
