import { motion } from "framer-motion";
import styles from "./Page.module.scss";

interface PageProps {
    children: React.ReactNode;
    className?: string;
}

export default function Page({ children, className }: PageProps) {
    const classList = [styles.page, className].filter(Boolean).join(' ');
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1}}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={classList}>
            {children}
        </motion.div>
    );
}

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
}

function Header({ title, className, children, ...props }: HeaderProps) {
    const classList = [styles.header, className].filter(Boolean).join(' ');
    return (
        <header className={classList} {...props}>
            <div className={styles.title}>
                <h1>{title}</h1>
            </div>
            <div className={styles.actions}>
                {children}
            </div>
        </header>
    );
}

interface ContentProps extends React.HTMLAttributes<HTMLDivElement> {
    onScrollToBottom?: () => void;
}

function Content({ onScrollToBottom, className, children, ...props }: ContentProps) {

    const classList = [styles.content, className].filter(Boolean).join(' ');

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 10) {
            onScrollToBottom?.();
        }
    };

    return (
        <div className={classList} {...props} onScroll={handleScroll}>
            {children}
        </div>
    );
}

Page.Header = Header;
Page.Content = Content;