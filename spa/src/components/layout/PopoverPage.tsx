import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEscHandler } from "../../hooks/useEscHandler";
import IconButton from "../icon/IconButton";
import styles from "./PopoverPage.module.scss";

interface PopoverPageProps {
    children: React.ReactNode;
    className?: string;
    width?: number;
}

const popoverContainerId = 'popover-container';

export default function PopoverPage({ children, className, width }: PopoverPageProps) {

    const navigate = useNavigate();
    useEscHandler(() => navigate('../'));

    const classList = [styles.page, className].filter(Boolean).join(' ');

    const container = useMemo(() => document.getElementById(popoverContainerId), []);
    if (!container) {
        return null;
    }

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={styles.background}>

            <motion.div
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ duration: 0.3 }}
                className={classList}
                style={{ width: width ?? 800 }}>
                {children}
            </motion.div>

        </motion.div>, container);

}

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
}

function Header({ title, className, ...props }: HeaderProps) {
    const navigate = useNavigate();
    const classList = [styles.header, className].filter(Boolean).join(' ');
    return (
        <header className={classList} {...props}>
            <IconButton icon="arrow_back" onClick={() => navigate('../')} className={styles.close} />
            <h1>{title}</h1>
        </header>
    );
}

function Content({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const classList = [styles.content, className].filter(Boolean).join(' ');
    return (
        <div className={classList} {...props}>
            {children}
        </div>
    );
}

PopoverPage.Header = Header;
PopoverPage.Content = Content;