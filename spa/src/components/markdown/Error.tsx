import styles from './Error.module.scss';

export default function Error({ message }: { message: string }) {
    return (
        <div className={styles.error}>{message}</div>
    );
}