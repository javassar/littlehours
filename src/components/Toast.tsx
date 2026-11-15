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
  durationMs,
}) => {
  // Give enough time to read based on message length (min 3.5s, up to 8s for long questions)
  const effectiveDuration = durationMs ?? Math.max(3500, Math.min(8000, (message?.length || 0) * 85));

  useEffect(() => {
    if (!visible || !onClose) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, effectiveDuration);

    return () => clearTimeout(timer);
  }, [visible, onClose, effectiveDuration]);

  if (!visible) return null;

  return (
    <div className="toast-portal" role="status" aria-live="polite">
      <div
        className="toast-pill"
        onClick={onClose}
        title="Tap to dismiss"
      >
        <Sparkle size={14} color="var(--gold)" />
        <span className="toast-message">{message}</span>
      </div>
    </div>
  );
};
