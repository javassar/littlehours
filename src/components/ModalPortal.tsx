import React from 'react';
import { createPortal } from 'react-dom';

export interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Renders modal dialogs and bottom sheets directly into document.body
 * so they are never trapped by local stacking contexts (such as page animations).
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
