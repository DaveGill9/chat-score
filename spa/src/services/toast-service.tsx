import type { ReactNode } from 'react';
import { generateId } from '../utils/nanoid';
import Icon from '../components/icon/Icon';
import { AxiosError } from 'axios';

export interface ToastData {
  id: string;
  type: 'info' | 'success' | 'error';
  icon: ReactNode;
  content: ReactNode;
  onClick: () => void;
  duration: number;
}

// Singleton pattern - store the callback function that adds toasts
let addToastCallback: ((toast: ToastData) => void) | null = null;
let removeToastCallback: ((id: string) => void) | null = null;

export function setToastCallbacks(
  add: (toast: ToastData) => void,
  remove: (id: string) => void
): void {
  addToastCallback = add;
  removeToastCallback = remove;
}

export function clearToastCallbacks(): void {
  addToastCallback = null;
  removeToastCallback = null;
}

function handleError(content: ReactNode | unknown): ReactNode {
  // custom: show validation errors
  if (content instanceof AxiosError) {
    const message = content.response?.data?.message;
    return message ?? 'Unknown error';
  }

  // custom: show error message
  if (content instanceof Error) {
    return content.message ?? 'Unknown error';
  }

  // custom: show string
  if (typeof content === 'string') {
    return content;
  }

  // everything else
  return content as ReactNode;
}

function showToast(data: Partial<ToastData>): string {
  if (!addToastCallback) {
    console.error('Toast service not initialized. Make sure ToastContainer is mounted.', data.content);
    return '';
  }

  const id = generateId();

  let icon: ReactNode;
  switch (data.type) {
    case 'info':
      icon = <Icon name="info" />;
      break;
    case 'success':
      icon = <Icon name="check" />;
      break;
    case 'error': 
      icon = <Icon name="error" />;
      break;
    default:
      if (typeof data.icon === 'string') {
        icon = <Icon name={data.icon} />;
      } else {
        icon = data.icon ?? <Icon name="info" />;
      }
      break;
  }

  const toast: ToastData = {
    id,
    type: data.type ?? 'info',
    icon,
    content: data.content,
    onClick: data.onClick ?? (() => dismissToast(id)),
    duration: data.duration ?? 5000,
  };

  addToastCallback(toast);

  // Auto-remove toast after duration (default 5000ms)
  if (toast.duration !== 0) {
    setTimeout(() => {
      removeToastCallback?.(id);
    }, toast.duration);
  }

  return id;
}

function dismissToast(id: string): void {
  removeToastCallback?.(id);
}

// Export toast object with methods
export const toast = {
  show: (options: Partial<ToastData>): string => showToast(options),
  info: (content: ReactNode, options?: Partial<ToastData>): string =>
    showToast({ ...options, type: 'info', content }),
  success: (content: ReactNode, options?: Partial<ToastData>): string =>
    showToast({ ...options, type: 'success', content }),
  error: (content: ReactNode | unknown, options?: Partial<ToastData>): string => 
    showToast({ ...options, type: 'error', content: handleError(content) }),
  dismiss: (id: string): void => dismissToast(id),
};
