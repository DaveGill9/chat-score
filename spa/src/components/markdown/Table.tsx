import styles from './Table.module.scss';
import { type TableHTMLAttributes } from 'react';

export default function Table({ children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
    return (
    <div className={styles.table}>
        <table {...rest}>
            {children}
        </table>
    </div>);
}