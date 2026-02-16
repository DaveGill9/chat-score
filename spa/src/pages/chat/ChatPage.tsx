import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactDOMServer from 'react-dom/server';
import usePagedRequest from '../../hooks/usePagedRequest';
import { useAuth } from '../../hooks/useAuth';
import { useOnce } from '../../hooks/useOnce';
import Page from '../../components/layout/Page';
import styles from './ChatPage.module.scss';
import IconButton from '../../components/icon/IconButton';
import Textarea from '../../components/input/Textarea';
import { type ChatMessage } from '../../types/ChatMessage';
import Button from '../../components/button/Button';
import Loading from '../../components/feedback/Loading';
import { generateId, sanitizeInput, timeOfDayGreeting } from '../../utils';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { useMarkdownComponents } from '../../hooks/useMarkdownComponents';
import { type GalleryImage } from '../../components/markdown/Gallery';
import { toast } from '../../services/toast-service';
import Icon from '../../components/icon/Icon';
import Feedback from '../../components/feedback/Feedback';
import apiClient from '../../services/api-client';
import AnimatedOutlet from '../../components/layout/AnimatedOutlet';
import CitationPreview from './CitationPreview';
import { type CitationReference } from '../../components/markdown/Citation';
import { streamEvents } from '../../services/sse-client';
import { eventBus } from '../../services/event-bus';

interface SSEMessageData {
    type: 'text' | 'status' | 'title';
    text?: string;
    status?: string;
    title?: string;
}

export default function Chat() {

    const navigate = useNavigate();
    const { user } = useAuth();
    const { chatId } = useParams();
    const [composeText, setComposeText] = useState("");
    const [working, setWorking] = useState(false);
    const [feedback, setFeedback] = useState("");

    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!chatId) {
            // new chat
            navigate(`/chat/${generateId()}`);
        }
        else {
            // reset things
            setComposeText("");

            // remove query string parameters without navigation
            window.history.replaceState({}, '', '/chat/' + chatId);
        }
    }, [chatId, navigate]);

    // Cleanup SSE connection on unmount or chatId change
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [chatId]);

    const url = chatId ? `/chats/${chatId}/messages` : '';
    const { data, setData, loading, hasMore, loadMore } =
        usePagedRequest<ChatMessage>(url, { reverseOrder: true });

    useOnce(!!data?.length, () => {
        // scroll to the bottom of the messages
        const messagesContainer = document.querySelector('#message-list');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    const handleSend = async () => {
        if (uploads.length > 0 && uploads.some(upload => upload.status === "working")) {
            toast.error("Please wait for all uploads to complete before sending a message");
            return;
        }

        const userMessage: ChatMessage = {
            _id: generateId(),
            chatId: chatId!,
            role: 'user',
            content: sanitizeInput(composeText),
            uploads: uploads.map(upload => upload.key),
            status: "done",
        }

        if (userMessage.content.length === 0 || working) return;

        // Add user message to the list
        setData(prev => [...(prev || []), userMessage]);
        setComposeText("");
        setUploads([]);
        setWorking(true);

        // Create assistant message placeholder
        const assistantMessageId = generateId();
        const assistantMessage: ChatMessage = {
            _id: assistantMessageId,
            chatId: chatId!,
            role: 'assistant',
            content: '',
            status: 'working',
        };
        setData(prev => [...(prev || []), assistantMessage]);

        // Abort any existing SSE connection
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        let accumulatedContent = '';

        const handleError = (message: string) => {
            console.error('SSE error:', message);
            toast.error('Failed to send message. Please try again.');
            setData(prev => prev?.map(m =>
                m._id === assistantMessageId
                    ? { ...m, content: 'An error occurred while processing your message.', status: 'error' as const }
                    : m
            ) ?? []);
            setWorking(false);
            setFeedback('');
        };

        const eventTarget = await streamEvents(
            '/chats/send',
            JSON.stringify({
                _id: userMessage._id,
                chatId: userMessage.chatId,
                role: userMessage.role,
                content: userMessage.content,
                uploads: userMessage.uploads,
                status: userMessage.status,
            }),
            abortControllerRef.current
        );

        eventTarget.addEventListener('message', (event: Event) => {
            const customEvent = event as CustomEvent<SSEMessageData>;
            const data = customEvent.detail;

            switch (data.type) {
                case 'title':
                    eventBus.emit('chat:updated', { _id: chatId!, title: data.title ?? '' });
                    break;

                case 'text':
                    accumulatedContent += data.text ?? '';
                    setData(prev => prev?.map(m =>
                        m._id === assistantMessageId
                            ? { ...m, content: accumulatedContent }
                            : m
                    ) ?? []);
                    break;

                case 'status':
                    setFeedback(data.status ?? '');
                    if (data.status === 'done') {
                        setData(prev => prev?.map(m =>
                            m._id === assistantMessageId
                                ? { ...m, status: 'done' as const }
                                : m
                        ) ?? []);
                        setWorking(false);
                        setFeedback('');
                    }
                    break;
            }
        });

        eventTarget.addEventListener('error', (event: Event) => {
            const customEvent = event as CustomEvent<{ message: string }>;
            handleError(customEvent.detail.message);
        });

        eventTarget.addEventListener('abort', () => {
            // Request was aborted, don't show error
        });
    };

    // #region custom markdown components

    const [citation, setCitation] = useState<CitationReference | null>(null);

    const showCitation = useCallback((reference: CitationReference) => {
        setCitation(reference);
    }, []);

    const showLightbox = (image: GalleryImage, collection: GalleryImage[]) => {
        console.log('showLightbox', image, collection);
    };

    const customComponents = useMarkdownComponents(showCitation, showLightbox);

    const INCOMPLETE_TRAILING_IMAGE_REGEX = /!\[[^)]+$/;

    const sanitizeMarkdown = (markdown: string) => {
        if (!markdown) {
            return markdown;
        }
        return markdown.replace(INCOMPLETE_TRAILING_IMAGE_REGEX, "");
    }

    // #endregion custom markdown components

    // #region message actions

    const copyToClipboard = async (markdown: string) => {

        markdown = markdown.replace(/`citation[\s\S]*?`/gi, '');

        const html = ReactDOMServer.renderToStaticMarkup(
            <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {markdown}
            </Markdown>
        );

        const fragment = `<!DOCTYPE html><html><body><!--StartFragment-->${html}<!--EndFragment--></body></html>`;

        const items: Record<string, Blob> = {
            "text/html": new Blob([fragment], { type: "text/html" }),
            "text/plain": new Blob([markdown], { type: "text/plain" }),
        };

        if ("clipboard" in navigator && "write" in navigator.clipboard) {
            await navigator.clipboard.write([new ClipboardItem(items)]);
        } else {
            await navigator.clipboard.writeText(markdown);
        }
        toast.success("Text copied to clipboard");
    };

    const toggleSentiment = (message: ChatMessage, sentiment: "good" | "bad" | undefined) => {
        const data = {
            chatId: chatId!,
            messageId: message._id,
            sentiment,
        };
        apiClient.post(`/chats/${chatId}/feedback`, data)
            .then(() => {
                setData(prev => prev?.map(m => m._id === message._id ? { ...m, sentiment } : m) ?? []);
            });
    }

    const actions = (message: ChatMessage) => (
        <div className={styles.actions}>
            <IconButton
                icon="content_copy"
                onClick={() => copyToClipboard(message.content)} />
            <IconButton
                icon="thumb_up"
                onClick={() => toggleSentiment(message, message.sentiment === "good" ? undefined : "good")}
                className={message.sentiment === "good" ? styles.good : ""} />
            <IconButton
                icon="thumb_down"
                onClick={() => toggleSentiment(message, message.sentiment === "bad" ? undefined : "bad")}
                className={message.sentiment === "bad" ? styles.bad : ""} />
        </div>
    );

    // #endregion message actions

    // #region file uploads

    interface ChatFileUpload {
        key: string;
        name: string;
        status: "working" | "ready";
    }

    const [uploads, setUploads] = useState<ChatFileUpload[]>([]);

    const uploadFile = () => {
        const file = document.createElement('input');
        file.type = 'file';
        file.multiple = true;
        file.accept = 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/plain,text/csv';
        file.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                // Limit to maximum 5 files
                if (files.length > 5) {
                    toast.error("Maximum 5 files can be uploaded at once");
                    return;
                }

                // Check if adding these files would exceed the limit
                if (uploads.length + files.length > 5) {
                    toast.error("Maximum 5 files total allowed");
                    return;
                }

                // Process each file
                Array.from(files).forEach(file => {
                    if (file.size > 10 * 1024 * 1024) {
                        toast.error(`File "${file.name}" size must be less than 10MB`);
                        return;
                    }

                    const __upload: ChatFileUpload = {
                        key: generateId(),
                        name: file.name,
                        status: "working",
                    }
                    setUploads(prev => [...prev, __upload]);
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('key', __upload.key);

                    apiClient
                        .post('/chats/upload', formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data',
                            },
                        })
                        .then(response => {
                            setUploads(prev => prev.map(upload => upload.key === __upload.key ? { ...upload, key: response.data.objectKey, status: "ready" } : upload));
                        })
                        .catch(error => {
                            toast.error(`Failed to upload file "${file.name}": ${error.response?.data?.message ?? "Unknown error"}`);
                            removeUpload(__upload.key);
                        });
                });
            }
        }
        file.click();
    }

    const removeUpload = (key: string) => {
        setUploads(prev => prev.filter(upload => upload.key !== key));
    }

    // #endregion file uploads

    return (
        <>
            <Page className={styles.chatPage}>

                <div className={styles.leftPanel}>

                    <div className={styles.messages} id="message-list">

                        {loading && <Feedback type="loading" />}

                        <div className={styles.float}>

                            {!loading && data?.length === 0 &&
                                <div className={styles.welcome}>
                                    <h1>{timeOfDayGreeting()}, {user?.displayName}</h1>
                                    <p>
                                        AI can make mistakes. If you're not sure about the answer, please check the documents.
                                    </p>
                                </div>
                            }

                            {!loading && hasMore &&
                                <Button
                                    type="button"
                                    onClick={loadMore}
                                    working={loading}
                                    className={styles.loadMore}
                                    variant='border'>
                                    Load more messages
                                </Button>}

                            {data?.map((message, index) => (
                                <div className={styles[message.role]}>
                                    {message.uploads && message.uploads.length > 0 &&
                                        <div className={styles.uploads}>
                                            {message.uploads.map((upload, index) => (
                                                <div key={index}>
                                                    <Icon name="attach_file" />
                                                    <span>{upload.split("/").pop()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    }
                                    <div key={index} className={styles.markdown}>
                                        <Markdown
                                            remarkPlugins={[remarkGfm, remarkBreaks]}
                                            components={customComponents}>
                                            {sanitizeMarkdown(message.content)}
                                        </Markdown>
                                        {message.role === 'assistant' && message.status !== "working" && actions(message)}
                                        {message.status === "working" && <Loading size="small" color="gray" />}
                                    </div>
                                </div>
                            ))}

                            {feedback &&
                                <div className={styles.feedback}>
                                    <Loading size="small" color="gray" />
                                    <span>{feedback}</span>
                                </div>
                            }

                        </div>
                    </div>

                    <div className={styles.compose}>
                        <div className={styles.float}>
                            {uploads.length > 0 &&
                                <div className={styles.uploads}>
                                    {uploads.map((upload, index) => (
                                        <div key={index}>
                                            <span>{upload.name}</span>
                                            {upload.status === "working" && <Loading size="small" color="gray" />}
                                            {upload.status === "ready" &&
                                                <IconButton
                                                    icon="close"
                                                    onClick={() => removeUpload(upload.key)} />
                                            }
                                        </div>
                                    ))}
                                </div>
                            }
                            <div className={styles.input}>
                                <IconButton
                                    icon="file_upload"
                                    disabled={working}
                                    onClick={uploadFile} />
                                <Textarea
                                    placeholder="New message"
                                    value={composeText}
                                    onTextChange={setComposeText}
                                    onEnter={handleSend} />
                                <IconButton
                                    icon="send"
                                    working={working}
                                    onClick={handleSend} />
                            </div>
                        </div>
                    </div>

                </div>

                <CitationPreview citation={citation} visible={!!citation} setVisible={() => setCitation(null)} />

            </Page>

            <AnimatedOutlet />

        </>

    );
}