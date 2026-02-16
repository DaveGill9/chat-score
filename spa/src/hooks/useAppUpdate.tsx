import { useEffect, useState, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { toast } from '../services/toast-service';
import Icon from '../components/icon/Icon';

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const updateServiceWorker = useCallback(async () => {
    if (!updateAvailable || !registrationRef.current) {
      return;
    }

    const registration = registrationRef.current;
    const waitingWorker = registration.waiting;

    if (waitingWorker) {
      // Tell the waiting service worker to skip waiting and activate
      // vite-plugin-pwa's service worker listens for this message
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for the service worker to activate
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        };
        
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        
        // Fallback timeout in case controllerchange doesn't fire
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        }, 1000);
      });

      // Reload the page to use the new service worker
      window.location.reload();
    } else {
      // If no waiting worker, just reload
      window.location.reload();
    }
  }, [updateAvailable]);

  useEffect(() => {
    // Register service worker using vite-plugin-pwa's register function
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // New content is available, show update prompt
        setUpdateAvailable(true);
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
      onRegistered(registration) {
        // Store registration for later use
        if (registration) {
          registrationRef.current = registration;
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour
        }
      },
      onRegisterError(error) {
        console.error('Service worker registration error:', error);
      },
    });
  }, []);

  // Show toast notification when update is available
  useEffect(() => {
    if (updateAvailable) {
      toast.info('New update available. Click to install.', {
        id: 'pwa-update',
        duration: 0,
        icon: <Icon name="refresh" />,
        onClick: () => {
          updateServiceWorker();
          toast.dismiss('pwa-update',);
          toast.info('Installing update...');
        },
      });
    } 
  }, [updateAvailable, updateServiceWorker]);

  return {
    updateAvailable,
    updateServiceWorker,
  };
}
