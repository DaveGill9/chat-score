import { useNavigate, useParams } from "react-router-dom";
import useFetchRequest from "../../hooks/useFetchRequest";
import PopoverPage from "../../components/layout/PopoverPage";
import Feedback from "../../components/feedback/Feedback";
import { type Document } from "../../types/Document";
import Chip from "../../components/chip/Chip";
import Button from "../../components/button/Button";
import { format } from "date-fns";
import { Alert } from "../../components/popover";
import { toast } from "../../services/toast-service";
import { useState } from "react";
import apiClient from "../../services/api-client";
import { eventBus } from "../../services/event-bus";
import styles from './DocumentDetailPage.module.scss';

export default function DocumentDetailPage() {

    const { id } = useParams();
    const { data, loading } = useFetchRequest<Document>(`/documents/${id}`);

    return (
        <PopoverPage>
            <PopoverPage.Header title="Document Detail" />
            <PopoverPage.Content>
                {loading && <Feedback type="loading" />}
                {!loading && data && <Content data={data} />}
            </PopoverPage.Content>
        </PopoverPage>);
}

function Content({ data }: { data: Document }) {

    const navigate = useNavigate(); 
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [working, setWorking] = useState(false);

    const deleteDocument = () => {
        setWorking(true);
        apiClient
            .delete(`/documents/${data._id}`)
            .then(() => {
                eventBus.emit('document-deleted', { documentId: data._id });
                toast.success('Document deleted successfully');
                navigate(`../`);
            })
            .catch(error => toast.error(error))
            .finally(() => {
                setConfirmVisible(false);
                setWorking(false);
            });
    }

    const downloadFile = () => {
        window.open(data.signedUrl, '_blank');
    }

    const fileType = data.fileName.split('.').pop()?.toLowerCase() ?? '';

    return (
        <div>
            <h1>{data.fileName}</h1>
            <p>{data.summary}</p>

            <br/>
            
            {['jpg','jpeg','png','gif','svg'].includes(fileType) && (
                <img src={data.signedUrl} className={styles.preview} />
            )}

            <dl>
                <dt>Status:</dt>
                <dd><Chip>{data.status}</Chip></dd>

                <dt>Page Count:</dt>
                <dd>{data.pageCount ?? '-'}</dd>

                <dt>Token Count:</dt>
                <dd>{data.tokenCount ?? '-'}</dd>

                <dt>Updated At:</dt>
                <dd>{format(data.updatedAt, 'h:mma d MMM yyyy')}</dd>
            </dl>

            <div className={styles.actions}>
                <Button type="button" working={working} onClick={() => setConfirmVisible(true)} className={styles.deleteButton}>Delete</Button>
                <Button type="button" onClick={() => downloadFile()}>Download File</Button>
            </div>

            <Alert
                title="Delete Document"
                children="Are you sure you want to delete this document?"
                visible={confirmVisible}
                setVisible={setConfirmVisible}
                confirmText="Delete"
                onConfirm={deleteDocument}
            />

        </div>
    );
}