import Popover from "./PopoverPortal";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Modal.module.scss";

interface ModalProps {
    children: React.ReactNode;
    className?: string;
    visible: boolean;
}

export default function Modal({ children, className, visible }: ModalProps) {

    const modalClassName = `${styles.modal} ${className || ''}`.trim();

    return (
        <AnimatePresence>
            {visible && (
                <Popover>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={styles.background}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: -30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            transition={{ duration: 0.2 }}
                            className={modalClassName}
                        >
                            {children}
                        </motion.div>
                    </motion.div>
                </Popover>
            )
            }
        </AnimatePresence >
    );
}