import { useNavigate } from "react-router-dom";
import Markdown from 'react-markdown';
import useFetchRequest from "../../hooks/useFetchRequest";
import { type CitationReference } from "../../components/markdown/Citation";
import IconButton from "../../components/icon/IconButton";
import Button from "../../components/button/Button";
import Feedback from "../../components/feedback/Feedback";
import Chip from "../../components/chip/Chip";
import styles from "./CitationPreview.module.scss";

interface CitationPreviewProps {
    citation: CitationReference | null;
    visible: boolean;
    setVisible: (visible: boolean) => void;
}

interface CitationPreviewDto {
    _id: string;
    fileName: string;
    pageNumber: number;
    title: string;
    content: string;
    previewUrl: string;
    downloadUrl: string;
  }

export default function CitationPreview({ citation, visible, setVisible }: CitationPreviewProps) {

    const navigate = useNavigate();

    const url = citation ? `/documents/citation?id=${citation.id}&pageNumber=${citation.pageNumber}` : '';
    const { data, loading } = useFetchRequest<CitationPreviewDto>(url);

    return (
        <div className={[styles.citation, visible ? styles.open : ""].join(" ")}>
            <div>
                <div className={styles.header}>
                    <small>Citation</small>
                    <IconButton
                        icon="right_panel_close"
                        onClick={() => setVisible(false)} />
                </div>

                <div className={styles.content}>
                    { loading && <Feedback type="loading" />}
                    { !loading && data && (
                        <>
                            <strong>{data.fileName}</strong> <Chip className={styles.pageNumber}>Page {data.pageNumber}</Chip>
                            <br/>
                            {data.previewUrl && data.downloadUrl?.includes('.pdf')  && <img src={data.previewUrl} alt={data.title} />}
                            <h2>Extracted Text</h2>
                            <Markdown>{data.content}</Markdown>
                            <Button 
                                type="button"
                                className={styles.viewDocument}
                                onClick={() => navigate(`document/${data._id}`)}>View Document</Button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}