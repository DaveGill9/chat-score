import styles from './Citation.module.scss';

export interface CitationReference {
    id: string;
    title: string;
    pageNumber: string;
}

interface CitationProps extends React.HTMLAttributes<HTMLSpanElement> {
    reference: CitationReference;
}

export default function Citation({ reference, ...rest }: CitationProps) {

    const { title, pageNumber } = reference;

    let label = title;
    if (pageNumber) {
        label += ` • Page ${pageNumber}`;
    }
    
    return (
        <span className={styles.citation} {...rest}>
            {label}
        </span>
    );
}