import { useNavigate } from 'react-router-dom';
import Icon from '../icon/Icon';
import styles from './DocumentList.module.scss';

export interface Document {
    id: string;
    title: string;
    summary: string;
}

interface DocumentListProps {
    documents: Document[];
}

export default function DocumentList({ documents }: DocumentListProps) {
    const navigate = useNavigate();
    return (
        <div className={styles.list}>                      
            {documents?.map((document: Document, index: number) => (
                <div key={index} onClick={() => navigate(`document/${document.id}`)}>
                    <div>
                        <Icon name="file_present" />
                        <strong>{document.title}</strong>
                    </div>
                    <small>{document.summary}</small>
                </div>
            ))}
        </div> 
    );
}