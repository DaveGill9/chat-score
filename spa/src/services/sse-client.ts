import { acquireAccessToken } from "./auth-service";

export const streamEvents = async (
    url: string,
    payload: BodyInit | null,
    abortController?: AbortController
): Promise<EventTarget> => {
    const accessToken = await acquireAccessToken();
    const apiUrl = import.meta.env.VITE_API_URL;
    const target = new EventTarget();

    fetch(`${apiUrl}${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: payload,
        signal: abortController?.signal,
    })
    .then(async response => {
        if (!response.ok) {
            target.dispatchEvent(new CustomEvent('error', { detail: { message: `HTTP error! status: ${response.status}` } }));
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            target.dispatchEvent(new CustomEvent('error', { detail: { message: 'No response body' } }));
            return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data: unknown = JSON.parse(line.slice(6));
                        target.dispatchEvent(new CustomEvent('message', { detail: data }));
                    } catch {
                        target.dispatchEvent(new CustomEvent('error', { 
                            detail: { message: `Failed to parse SSE data: ${line}` } 
                        }));
                    }
                }
            }
        }

        if (buffer.startsWith('data: ')) {
            try {
                const data: unknown = JSON.parse(buffer.slice(6));
                target.dispatchEvent(new CustomEvent('message', { detail: data }));
            } catch {
                // Ignore incomplete final chunk
            }
        }

        target.dispatchEvent(new CustomEvent('complete'));
    })
    .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') {
            target.dispatchEvent(new CustomEvent('abort'));
        } else {
            const message = error instanceof Error ? error.message : 'Unknown error';
            target.dispatchEvent(new CustomEvent('error', { detail: { message } }));
        }
    });

    return target;
};