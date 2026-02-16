import { createPortal } from 'react-dom';
import { useMemo } from 'react';

const popoverContainerId = 'popover-portal';

export default function PopoverPortal({ children }: { children: React.ReactNode }) {
  const container = useMemo(() => document.getElementById(popoverContainerId), []);
  
  if (!container) {
    return null;
  }
  
  return createPortal(children, container);
}

export function PopoverContainer() {
  return (
    <div id={popoverContainerId} />
  );
}