import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import usePagedRequest from '../../hooks/usePagedRequest';
import Feedback from '../../components/feedback/Feedback';
import AnimatedOutlet from '../../components/layout/AnimatedOutlet';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import Button from '../../components/button/Button';
import Chip from '../../components/chip/Chip';
import IconButton from '../../components/icon/IconButton';
import Input from '../../components/input/Input';
import { addSearchParams } from '../../utils';
import { type EventLog } from '../../types/EventLog';
import styles from './LogsPage.module.scss';

export default function Logs() {

    const navigate = useNavigate();
    const [keywords, setKeywords] = useState('');
    const baseUrl = '/event-logs';
    const [url, setUrl] = useState(baseUrl);
    const { data, reset, loading, loadMore } = usePagedRequest<EventLog>(url);

    const handleSearch = () => {
        setUrl(addSearchParams(baseUrl, { keywords }));
    }

    const levelIcons: Record<string, string> = {
        "debug": 'bug_report',
        "info": 'info',
        "warn": 'warning',
        "error": 'error',
        "fatal": 'block',
    }  

    return (
        <>        
            <Page>
                <Page.Header title="Logs">
                    <Input type="search" placeholder="Search logs" value={keywords} onTextChange={setKeywords} onEnter={handleSearch} />
                    <IconButton icon="cached" onClick={() => reset()} />
                </Page.Header>
                <Page.Content onScrollToBottom={loadMore}>

                    {loading && <Feedback type="loading" />}

                    {data?.length === 0 && <Feedback type="empty">No logs found</Feedback>}

                    {data?.map(log => (
                        <Button type="block" key={log._id} className={styles.log} onClick={() => navigate(log._id)}>
                            <Icon name={levelIcons[log.level]} />
                            <strong>{log.message.slice(0, 100)}</strong>
                            <span>{format(log.createdAt, 'h:mma d MMM yyyy')}</span>
                            <Chip>{log.group}</Chip>
                        </Button>
                    ))}

                </Page.Content>
            </Page>

            <AnimatedOutlet />

        </>
    );
}