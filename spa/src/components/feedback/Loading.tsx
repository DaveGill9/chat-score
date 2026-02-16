import styles from './Loading.module.scss';

export interface LoadingProps {
    size?: 'small' | 'medium' | 'large';
    color?: | 'accent' | 'gray' | 'reverse';
    className?: string;
}

const Loading = ({ size = 'medium', color = 'accent', className }: LoadingProps) => {
    const classList = [styles.loading, styles[size], styles[color], className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classList} />
    );
};

export default Loading;

