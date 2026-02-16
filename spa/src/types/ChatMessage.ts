export type ChatMessage = {
    _id: string;
    chatId: string;
    role: "user" | "assistant";
    content: string;
    sentiment?: "good" | "bad";
    comments?: string;
    uploads?: string[];
    status?: "pending" | "working" | "done" | "error";
}