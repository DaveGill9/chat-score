import { useOutlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import React, { cloneElement, useRef, useEffect, useState } from "react";

export default function AnimatedOutlet() {
    const outlet = useOutlet();
    const location = useLocation();
    const isInitialMount = useRef(true);
    const [skipAnimation, setSkipAnimation] = useState(true);

    const findKey = (element: React.ReactElement): string | number | null | undefined => {
        if (!element) return undefined;
        const props = element.props as Record<string, unknown>;
        if (props && typeof props === 'object' && 'children' in props && props.children) {
            const children = props.children;
            if ("key" in props && props.key) {
                return props.key as string | number | null | undefined;
            }
            if (React.isValidElement(children)) {
                return findKey(children);
            }
        }
        return element.key;
    }

    const key = findKey(outlet as React.ReactElement) || location.pathname;

    useEffect(() => {
        // After first render cycle, we're no longer on initial mount
        // Use a small delay to ensure outlet has time to be available on nested routes
        const timer = setTimeout(() => {
            isInitialMount.current = false;
            setSkipAnimation(false);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    // On initial mount, render outlet immediately without animation if it exists
    // This handles nested routes that load on page refresh
    if (skipAnimation && outlet) {
        return <>{outlet}</>;
    }

    return (
        <AnimatePresence mode="wait" initial={false}>
            {outlet && cloneElement(outlet, { key })}
        </AnimatePresence>
    );
}