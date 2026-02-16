import { useParams } from "react-router-dom";
import useFetchRequest from "../../hooks/useFetchRequest";
import PopoverPage from "../../components/layout/PopoverPage";
import Feedback from "../../components/feedback/Feedback";
import { type EventLog } from "../../types/EventLog";
import Chip from "../../components/chip/Chip";
import { Fragment } from "react/jsx-runtime";
import { format } from "date-fns";
import styles from "./LogDetailPage.module.scss";

export default function LogDetailPage() {

    const { id } = useParams();
    const { data, loading } = useFetchRequest<EventLog>(`/event-logs/${id}`);

    return (
        <PopoverPage>
            <PopoverPage.Header title="Log Detail" />
            <PopoverPage.Content>
                {loading && <Feedback type="loading" />}
                {!loading && data && <Content data={data} />}
            </PopoverPage.Content>
        </PopoverPage>);
}

function Content({ data }: { data: EventLog }) {
    return (
        <div>
            <h1>{data.message}</h1>

            {data.stackTrace && (
                <>
                    <h2>Stack Trace</h2>
                    <pre>{data.stackTrace}</pre>
                </>
            )}

            <div className={styles.meta}>
                <div>
                    <strong>Group:</strong>
                    <span>{data.group}</span>
                </div>
                <div>
                    <strong>Level:</strong>
                    <span><Chip>{data.level}</Chip></span>
                </div>
                <div>
                    <strong>Created At:</strong>
                    <span>{format(data.createdAt, 'h:mma d MMM yyyy')}</span>
                </div>
            </div>

            <h2>Properties</h2>
            {data.group === 'OpenAI' ?
                <OpenAIProperties properties={data.properties} /> :
                <Properties properties={data.properties} />}

        </div>
    );
}

function Properties({ properties }: { properties: Record<string, unknown> }) {
    return (
        <dl>
            {Object.entries(properties ?? {}).map(([key, value]) => (
                <Fragment key={key}>
                    <dt>{key}:</dt>
                    <dd>{value instanceof String ? value : JSON.stringify(value)}</dd>
                </Fragment>
            ))}
        </dl>
    );
}

interface Message {
    role: string;
    content: string | ContentImage[];
    tool_call_id: string;
    tool_calls?: {
        id: string;
        type: string;
        function: {
            arguments: string;
            name: string;
        }
    }[];
}

interface ContentImage {
    type: string,
    image_url: string,
    detail: string,
}

interface ToolCall {
    arguments: string;
    call_id: string;
    id: string;
    name: string;
    status: string;
    type: string;
}

interface ToolCallOutput {
    call_id: string;
    output: string;
    type: string;
}

type InputMessage = Message | ToolCall | ToolCallOutput;

function OpenAIProperties({ properties }: { properties: Record<string, unknown> }) {

    const { model, input, output, usage } = properties as {
        model: string, 
        input: Record<string, unknown>, 
        output: string
        usage: {
            inputTokens: number;
            outputTokens: number;
            cachedTokens: number;
        }
    };

    return (
        <>
            <dl>
                <dt>Model:</dt>
                <dd>{model}</dd>
                <dt>Input Tokens:</dt>
                <dd>{usage.inputTokens}</dd>
                <dt>Output Tokens:</dt>
                <dd>{usage.outputTokens}</dd>
                <dt>Cached Tokens:</dt>
                <dd>{usage.cachedTokens}</dd>
            </dl>

            {(input as unknown as InputMessage[]).map((message: InputMessage, index: number) => (
                <div key={index} className={styles.message}>
                    {
                        "role" in message && (
                            <>
                                <strong>{message.role}</strong>
                                {
                                    typeof message.content === 'string' ? (
                                        <pre>{message.content || 'No content'}</pre>
                                    ) : (
                                        message.content.map((image: ContentImage, index: number) => {
                                            return <img key={index} src={image.image_url} />;
                                        })
                                    )
                                }
                            </>
                        )
                    }
                    {
                        "arguments" in message && (
                            <>
                                <strong>Tool: {message.name}</strong>
                                <pre>{JSON.stringify(JSON.parse(message.arguments || '{}'), null, 2)}</pre>
                            </>
                        )
                    }
                    {
                        "output" in message && (
                            <>
                                <strong>Tool Output</strong>
                                <pre>{message.output || 'No output'}</pre>
                            </>
                        )
                    }
                </div>
            ))}

            <div className={styles.message}>
                <strong>assistant</strong>
                <pre>{JSON.stringify(output, null, 2)}</pre>
            </div>
        </>
    );
}