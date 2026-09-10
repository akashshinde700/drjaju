import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  // Provide a stable `showToast` API for components that expect it
  return {
    showToast: ctx.addToast,
    ...ctx
  };
}