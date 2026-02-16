import { useEffect } from 'react';

const escStack: (() => void)[] = [];
let isGlobalListenerActive = false;

function handleEscKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && escStack.length > 0) {
    const topHandler = escStack[escStack.length - 1];
    topHandler();
  }
}

function setupGlobalEscListener() {
  if (!isGlobalListenerActive) {
    document.addEventListener('keydown', handleEscKey);
    isGlobalListenerActive = true;
  }
}

function teardownGlobalEscListener() {
  if (isGlobalListenerActive) {
    document.removeEventListener('keydown', handleEscKey);
    isGlobalListenerActive = false;
  }
}

export function useEscHandler(callback: () => void) {
  useEffect(() => {
    if (escStack.length === 0) {
      setupGlobalEscListener();
    }
    
    escStack.push(callback);
    
    return () => {
      escStack.pop();
      
      if (escStack.length === 0) {
        teardownGlobalEscListener();
      }
    };
  }, [callback]);
}