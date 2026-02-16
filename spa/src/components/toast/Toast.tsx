import { useEffect, useState } from 'react';
import { setToastCallbacks, clearToastCallbacks, type ToastData } from '../../services/toast-service';
import styles from './Toast.module.scss';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const handleClick = () => {
    toast.onClick?.();
    onRemove(toast.id);
  };

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`} onClick={handleClick}>
      {toast.icon}
      <span>{toast.content}</span>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Register callbacks with the toast service
  useEffect(() => {
    const addToast = (toast: ToastData) => setToasts((prev) => [...prev, toast]);
    const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
    setToastCallbacks(addToast, removeToast);
    return () => clearToastCallbacks();
  }, []);

  return (
    <div className={styles.toastContainer}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div 
            key={toast.id} 
            initial={{ opacity: 0, x: 50, y: 0 }} 
            animate={{ opacity: 1, x: 0, y: 0 }} 
            exit={{ opacity: 0, x: 200, y: 0 }}>
            <Toast toast={toast} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
