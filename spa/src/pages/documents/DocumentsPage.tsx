import { useState } from 'react';
import { format } from 'date-fns';
import usePagedRequest from '../../hooks/usePagedRequest';
import Feedback from '../../components/feedback/Feedback';
import AnimatedOutlet from '../../components/layout/AnimatedOutlet';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import Chip from '../../components/chip/Chip';
import IconButton from '../../components/icon/IconButton';
import Input from '../../components/input/Input';
import { Tooltip } from '../../components/popover';
import apiClient from '../../services/api-client';
import { addSearchParams, generateId } from '../../utils';
import type { Document } from '../../types/Document';
import { toast } from '../../services/toast-service';
import styles from './DocumentsPage.module.scss';
import Button from '../../components/button/Button';
import { useNavigate } from 'react-router-dom';
import { useEventBus } from '../../hooks/useEventBus';

export default function Documents() {
    const navigate = useNavigate();
    const [keywords, setKeywords] = useState('');
    const baseUrl = '/documents';
    const [url, setUrl] = useState(baseUrl);
    const { data, setData,reset, loading, loadMore } = usePagedRequest<Document>(url);

    useEventBus('document-deleted', (data) => {
        setData(prev => prev?.filter(document => document._id !== data.documentId) || []);
    }, [setData]);

    const handleSearch = () => {
        setUrl(addSearchParams(baseUrl, { keywords }));
    }

    const selectFiles = () => {
        console.log('selectFiles');
        const file = document.createElement('input');
        file.type = 'file';
        file.multiple = true;
        file.accept = 'application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png';
        file.onchange = (event) => {
            handleFiles((event.target as HTMLInputElement).files as FileList);
        };
        file.click();
    }

    const handleFiles = (files: FileList) => {
        for (const file of files) {
            const id = generateId();
            const url = `/documents/${id}/upload-data`;
            const data = { fileName: file.name };
            apiClient
                .post(url, data)
                .then(response => response.data.signedUrl)
                .then(signedUrl => uploadFile(id, file, signedUrl))
                .catch(error => toast.error(error));
        }
    }

    const uploadFile = (id: string, file: File, uploadUrl: string) => {
        const headers: HeadersInit = {
            'Content-Type': file.type || 'application/octet-stream',
            'x-ms-blob-type': 'BlockBlob',
        };
        const options: RequestInit = { 
            method: 'PUT', 
            body: file,
            headers
        };
        fetch(uploadUrl, options)
            .then(response => {
                if (response.status === 201) {
                    createDocument(id, file.name);
                } else {
                    toast.error(`Failed to upload file: ${response.statusText}`);
                }
            })
            .catch(error => toast.error(error));
    }

    const createDocument = (_id: string, fileName: string) => {
        const data = { _id, fileName };
        apiClient.post('/documents', data)
            .then(response => setData(prev => prev ? [...prev, response.data] : [response.data]))
            .catch(error => toast.error(error));
    }

    return (
        <>        
            <Page>
                <Page.Header title="Documents">
                    <Input type="search" placeholder="Find documents" value={keywords} onTextChange={setKeywords} onEnter={handleSearch} />
                    <Tooltip text="Upload a document"><IconButton icon="upload" onClick={selectFiles} /></Tooltip>
                    <Tooltip text="Refresh"><IconButton icon="cached" onClick={reset} /></Tooltip>
                </Page.Header>
                <Page.Content onScrollToBottom={loadMore}>

                    {loading && <Feedback type="loading" />}

                    {data?.length === 0 && <Feedback type="empty" children="No documents found" />}

                    {data?.map(document => (
                        <Button type="block" key={document._id} className={styles.document} onClick={() => navigate(`document/${document._id}`)}>
                            <Icon name="file_present" />
                            <strong>{document.fileName}</strong>
                            <span>{format(document.updatedAt, 'h:mma d MMM yyyy')}</span>
                            <Chip>{document.status}</Chip>
                        </Button>
                    ))}

                </Page.Content>
            </Page>

            <AnimatedOutlet />

        </>
    );
}