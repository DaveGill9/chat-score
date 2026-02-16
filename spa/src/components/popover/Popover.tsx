import { AnimatePresence, motion } from 'framer-motion';
import PopoverPortal from './PopoverPortal';
import { useState, cloneElement, isValidElement, useEffect, useRef, useCallback } from 'react';
import styles from './Popover.module.scss';

type Position = 'left' | 'right' | 'top' | 'bottom';

interface PopoverProps {
    menu: React.ReactElement;
    visible?: boolean;
    setVisible?: (visible: boolean) => void;
    className?: string;
    selectedClassName?: string;
    children: React.ReactElement;
    position?: Position;
    anchor?: Position;
    width?: number | 'auto'
    closeOnClick?: boolean;
    trigger?: 'click' | 'hover';
    offset?: number;
}

export default function Popover(props: PopoverProps) {

    const { 
        visible, 
        setVisible, 
        menu, 
        className, 
        selectedClassName, 
        children, 
        position = 'bottom', 
        anchor,
        closeOnClick = true,
        width,
        trigger = 'click',
        offset = 0
    } = props;
    const [isOpen, _setIsOpen] = useState(visible);
    const setIsOpen = useCallback((visible: boolean) => {
        _setIsOpen(visible);
        setVisible?.(visible);
    }, [setVisible]);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);
    const [adjustedPosition, setAdjustedPosition] = useState<Position>(position);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLElement>(null);
    const popoverClassName = `${styles.popover} ${className || ''}`.trim();

    useEffect(() => {
        _setIsOpen(visible ?? false);
    }, [visible]);

    useEffect(() => {
        setAdjustedPosition(position);
    }, [position]);

    const calculatePosition = useCallback((buttonRect: DOMRect, menuRect?: DOMRect) => {
        let top = 0;
        let left = 0;

        // Calculate base position based on position prop
        switch (position) {
            case 'bottom':
                top = buttonRect.bottom + offset;
                left = buttonRect.left;
                break;
            case 'top':
                top = buttonRect.top - offset;
                left = buttonRect.left;
                break;
            case 'right':
                top = buttonRect.top;
                left = buttonRect.right + offset;
                break;
            case 'left':
                top = buttonRect.top;
                left = buttonRect.left - offset;
                break;
        }

        // Apply anchor adjustments
        if (menuRect) {
            // If position is left or right, adjust vertically based on anchor
            if (position === 'left' || position === 'right') {
                if (anchor === 'top') {
                    // Align menu top with button top
                    top = buttonRect.top;
                } else if (anchor === 'bottom') {
                    // Align menu bottom with button bottom
                    top = buttonRect.bottom - menuRect.height;
                } else {
                    // Center vertically (default)
                    top = buttonRect.top + (buttonRect.height / 2) - (menuRect.height / 2);
                }
            }
            // If position is top or bottom, adjust horizontally based on anchor
            else if (position === 'top' || position === 'bottom') {
                if (anchor === 'left') {
                    // Align menu left with button left
                    left = buttonRect.left;
                } else if (anchor === 'right') {
                    // Align menu right with button right
                    left = buttonRect.right - menuRect.width;
                } else {
                    // Center horizontally (default)
                    left = buttonRect.left + (buttonRect.width / 2) - (menuRect.width / 2);
                }
            }
        } else {
            // Initial calculation without menu dimensions - will be adjusted later
            if (position === 'left' || position === 'right') {
                if (anchor === 'top') {
                    top = buttonRect.top;
                } else if (anchor === 'bottom') {
                    // Will be adjusted after we know menu height
                    top = buttonRect.bottom;
                } else {
                    // Center vertically - will be adjusted after we know menu height
                    top = buttonRect.top + buttonRect.height / 2;
                }
            } else if (position === 'top' || position === 'bottom') {
                if (anchor === 'left') {
                    left = buttonRect.left;
                } else if (anchor === 'right') {
                    // Will be adjusted after we know menu width
                    left = buttonRect.right;
                } else {
                    // Center horizontally - will be adjusted after we know menu width
                    left = buttonRect.left + buttonRect.width / 2;
                }
            }
        }

        return { top, left };
    }, [position, anchor, offset]);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isOpen) {
            setIsOpen(false);
            return;
        }
        
        // Reset adjusted position to original position when opening
        setAdjustedPosition(position);
        
        // Calculate menu position based on button position
        // Using viewport coordinates since we'll use position: fixed
        if (buttonRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const initialPosition = calculatePosition(buttonRect);
            
            setMenuPosition(initialPosition);
            
            // Calculate width if it's 'auto' to match button width
            if (width === 'auto') {
                setMenuWidth(buttonRect.width);
            } else if (typeof width === 'number') {
                setMenuWidth(width);
            }
            // If width is undefined, don't adjust the width (leave menuWidth as is)
        }
        
        setIsOpen(true);
    };

    const handleClose = useCallback((e: MouseEvent) => {
        // Don't close if clicking inside the popup (unless closeOnClick is true)
        if (!closeOnClick && popoverRef.current && popoverRef.current.contains(e.target as Node)) {
            return;
        }
        setIsOpen(false);
        setMenuPosition(null);
        setMenuWidth(undefined);
        setAdjustedPosition(position);
    }, [closeOnClick, setIsOpen, position]);

    const handleMouseEnter = useCallback((e: React.MouseEvent) => {
        if (trigger === 'hover' && !isOpen) {
            e.stopPropagation();
            
            // Reset adjusted position to original position when opening
            setAdjustedPosition(position);
            
            // Calculate menu position based on button position
            if (buttonRef.current) {
                const buttonRect = buttonRef.current.getBoundingClientRect();
                const initialPosition = calculatePosition(buttonRect);
                
                setMenuPosition(initialPosition);
                
                // Calculate width if it's 'auto' to match button width
                if (width === 'auto') {
                    setMenuWidth(buttonRect.width);
                } else if (typeof width === 'number') {
                    setMenuWidth(width);
                }
            }
            
            setIsOpen(true);
        }
    }, [trigger, isOpen, position, width, setIsOpen, calculatePosition]);

    const handleMouseLeave = useCallback((e: React.MouseEvent) => {
        if (trigger === 'hover') {
            // Check if mouse is leaving both the trigger and the menu
            const relatedTarget = e.relatedTarget;
            const isNode = relatedTarget instanceof Node;
            if (
                buttonRef.current && 
                (!isNode || !buttonRef.current.contains(relatedTarget)) &&
                popoverRef.current && 
                (!isNode || !popoverRef.current.contains(relatedTarget))
            ) {
                setIsOpen(false);
                setMenuPosition(null);
                setMenuWidth(undefined);
                setAdjustedPosition(position);
            }
        }
    }, [trigger, setIsOpen, position]);

    const handleMenuMouseLeave = useCallback((e: React.MouseEvent) => {
        if (trigger === 'hover') {
            // Check if mouse is leaving the menu and not entering the trigger
            const relatedTarget = e.relatedTarget;
            const isNode = relatedTarget instanceof Node;
            if (
                buttonRef.current && 
                (!isNode || !buttonRef.current.contains(relatedTarget))
            ) {
                setIsOpen(false);
                setMenuPosition(null);
                setMenuWidth(undefined);
                setAdjustedPosition(position);
            }
        }
    }, [trigger, setIsOpen, position]);

    useEffect(() => {
        if (isOpen && menuPosition && popoverRef.current && buttonRef.current) {
            const menuRect = popoverRef.current.getBoundingClientRect();
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Recalculate position with anchor using menu dimensions
            const calculatedPosition = calculatePosition(buttonRect, menuRect);
            let newTop = calculatedPosition.top;
            let newLeft = calculatedPosition.left;
            let newPosition = position;
            
            // Adjust position for top placement
            if (position === 'top') {
                newTop = buttonRect.top - menuRect.height - offset;
                // Reapply anchor after adjusting for top placement
                if (anchor === 'left') {
                    newLeft = buttonRect.left;
                } else if (anchor === 'right') {
                    newLeft = buttonRect.right - menuRect.width;
                } else {
                    newLeft = buttonRect.left + (buttonRect.width / 2) - (menuRect.width / 2);
                }
            }
            
            // Adjust position for left placement
            if (position === 'left') {
                newLeft = buttonRect.left - menuRect.width - offset;
                // Reapply anchor after adjusting for left placement
                if (anchor === 'top') {
                    newTop = buttonRect.top;
                } else if (anchor === 'bottom') {
                    newTop = buttonRect.bottom - menuRect.height;
                } else {
                    newTop = buttonRect.top + (buttonRect.height / 2) - (menuRect.height / 2);
                }
            }
            
            // Check for vertical overflow and flip if needed
            if (position === 'bottom' && newTop + menuRect.height > viewportHeight) {
                // Would overflow bottom, flip to top
                newTop = buttonRect.top - menuRect.height - offset;
                newPosition = 'top';
                // Reapply anchor after flipping
                if (anchor === 'left') {
                    newLeft = buttonRect.left;
                } else if (anchor === 'right') {
                    newLeft = buttonRect.right - menuRect.width;
                } else {
                    newLeft = buttonRect.left + (buttonRect.width / 2) - (menuRect.width / 2);
                }
            } else if (position === 'top' && newTop < 0) {
                // Would overflow top, flip to bottom
                newTop = buttonRect.bottom + offset;
                newPosition = 'bottom';
                // Reapply anchor after flipping
                if (anchor === 'left') {
                    newLeft = buttonRect.left;
                } else if (anchor === 'right') {
                    newLeft = buttonRect.right - menuRect.width;
                } else {
                    newLeft = buttonRect.left + (buttonRect.width / 2) - (menuRect.width / 2);
                }
            }
            
            // Check for horizontal overflow and flip if needed
            if (position === 'right' && newLeft + menuRect.width > viewportWidth) {
                // Would overflow right, flip to left
                newLeft = buttonRect.left - menuRect.width - offset;
                newPosition = 'left';
                // Reapply anchor after flipping
                if (anchor === 'top') {
                    newTop = buttonRect.top;
                } else if (anchor === 'bottom') {
                    newTop = buttonRect.bottom - menuRect.height;
                } else {
                    newTop = buttonRect.top + (buttonRect.height / 2) - (menuRect.height / 2);
                }
            } else if (position === 'left' && newLeft < 0) {
                // Would overflow left, flip to right
                newLeft = buttonRect.right + offset;
                newPosition = 'right';
                // Reapply anchor after flipping
                if (anchor === 'top') {
                    newTop = buttonRect.top;
                } else if (anchor === 'bottom') {
                    newTop = buttonRect.bottom - menuRect.height;
                } else {
                    newTop = buttonRect.top + (buttonRect.height / 2) - (menuRect.height / 2);
                }
            }
            
            // Ensure menu stays within viewport bounds (clamp if still out of bounds)
            if (newTop + menuRect.height > viewportHeight) {
                newTop = Math.max(0, viewportHeight - menuRect.height);
            }
            if (newTop < 0) {
                newTop = 0;
            }
            if (newLeft + menuRect.width > viewportWidth) {
                newLeft = Math.max(0, viewportWidth - menuRect.width);
            }
            if (newLeft < 0) {
                newLeft = 0;
            }
            
            if (newTop !== menuPosition.top || newLeft !== menuPosition.left) {
                setMenuPosition({ top: newTop, left: newLeft });
            }
            if (newPosition !== adjustedPosition) {
                setAdjustedPosition(newPosition);
            }
        }
    }, [isOpen, menuPosition, position, adjustedPosition, calculatePosition, anchor, offset]);

    useEffect(() => {
        if (isOpen && trigger === 'click') {
            // Use setTimeout to avoid immediate closure when opening
            const timeoutId = setTimeout(() => {
                document.addEventListener('click', handleClose);
            }, 0);
            
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('click', handleClose);
            };
        }
    }, [isOpen, handleClose, trigger]);

    // Clone the button element and attach onClick handler and ref
    const triggerElement = isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ 
            onClick?: (e: React.MouseEvent) => void; 
            onMouseEnter?: (e: React.MouseEvent) => void;
            onMouseLeave?: (e: React.MouseEvent) => void;
            ref?: React.Ref<HTMLElement>; 
            className?: string 
        }>, {
            ref: (node: HTMLElement | null) => {
                buttonRef.current = node;
                // Handle original ref if it exists
                const originalRef = (children as React.ReactElement<{ ref?: React.Ref<HTMLElement> }>).props.ref;
                if (typeof originalRef === 'function') {
                    originalRef(node);
                } else if (originalRef && typeof originalRef === 'object' && 'current' in originalRef) {
                    (originalRef as { current: HTMLElement | null }).current = node;
                }
            },
            onClick: (e: React.MouseEvent) => {
                // Call original onClick if it exists
                const originalOnClick = (children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick;
                if (originalOnClick) {
                    originalOnClick(e);
                }
                // Only handle popover open/close for click trigger
                if (trigger === 'click') {
                    handleOpen(e);
                }
            },
            onMouseEnter: trigger === 'hover' ? (e: React.MouseEvent) => {
                // Call original onMouseEnter if it exists
                const originalOnMouseEnter = (children as React.ReactElement<{ onMouseEnter?: (e: React.MouseEvent) => void }>).props.onMouseEnter;
                if (originalOnMouseEnter) {
                    originalOnMouseEnter(e);
                }
                handleMouseEnter(e);
            } : undefined,
            onMouseLeave: trigger === 'hover' ? (e: React.MouseEvent) => {
                // Call original onMouseLeave if it exists
                const originalOnMouseLeave = (children as React.ReactElement<{ onMouseLeave?: (e: React.MouseEvent) => void }>).props.onMouseLeave;
                if (originalOnMouseLeave) {
                    originalOnMouseLeave(e);
                }
                handleMouseLeave(e);
            } : undefined,
            className: (() => {
                const originalClassName = (children as React.ReactElement<{ className?: string }>).props.className || '';
                return isOpen && selectedClassName 
                    ? `${originalClassName} ${selectedClassName}`.trim()
                    : originalClassName;
            })(),
        })
        : children;

    return (
        <>
            {triggerElement}
            <AnimatePresence>
                {isOpen && menuPosition && (
                    <PopoverPortal>
                        <motion.div
                            ref={popoverRef}
                            className={popoverClassName}
                            style={{
                                top: `${menuPosition.top}px`,
                                left: `${menuPosition.left}px`,
                                ...(menuWidth !== undefined && { width: `${menuWidth}px` }),
                            }}
                            onMouseLeave={trigger === 'hover' ? handleMenuMouseLeave : undefined}
                            initial={{ 
                                opacity: 0, 
                                y: adjustedPosition === 'top' ? 10 : adjustedPosition === 'bottom' ? -10 : 0,
                                x: adjustedPosition === 'left' ? -10 : adjustedPosition === 'right' ? 10 : 0,
                            }}
                            animate={{ 
                                opacity: 1, 
                                y: 0,
                                x: 0,
                            }}
                            exit={{ 
                                opacity: 0, 
                                y: adjustedPosition === 'top' ? 10 : adjustedPosition === 'bottom' ? -10 : 0,
                                x: adjustedPosition === 'left' ? -10 : adjustedPosition === 'right' ? 10 : 0,
                            }}
                            transition={{ duration: 0.2 }}
                        >
                            {menu}
                        </motion.div>
                    </PopoverPortal>
                )}
            </AnimatePresence>
        </>
    );
}