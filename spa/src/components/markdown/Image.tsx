import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import styles from './Image.module.scss';
import Icon from '../icon/Icon';
import Feedback from '../feedback/Feedback';

export default function CustomImage(props: ImgHTMLAttributes<HTMLImageElement>) {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!props.src) return;
        const img = new Image();
        img.src = props.src as string;
        img.onload = () => {
            setLoading(false);
        }
        img.onerror = () => {
            setLoading(false);
            setError(true);
        }
    }, [props.src]);

    if (error) {
        return (
            <div className={styles.error}>
                <Icon name="hide_image" />
            </div>);
    }

    if (loading) {
        return (
            <div className={styles.loading}>
                <Feedback type="loading" />
            </div>);
    }
    
    return (
        <div className={styles.figure}>
            <img {...props} />
        </div>);
}