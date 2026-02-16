export type EventLog = {
    _id: string;
    group: string;
    level: string;
    message: string;
    properties: Record<string, unknown>;
    stackTrace?: string;
    createdAt: Date;
}