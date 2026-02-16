import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ChatMessage, ChatMessageDocument } from "../entities/chat-message.entity";
import { CreateChatMessage } from "../types/create-chat-message.type";
import { UpdateChatMessage } from "../types/update-chat-message.type";
import { FindChatMessagesFilter } from "../types/find-chat-messages-filter.type";
import { Projection } from "src/types/projection.type";
import { SortOrder } from "mongoose";

@Injectable()
export class ChatMessageService {

    constructor(
        @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    ) { }

    async create(data: CreateChatMessage): Promise<ChatMessage> {
        const chatMessage = new this.chatMessageModel(data);
        return await chatMessage.save();
    }

    async update(_id: string, data: UpdateChatMessage): Promise<ChatMessage | null> {
        const filter = { _id: { $eq: _id } };
        const options = { new: true };
        return await this.chatMessageModel.findOneAndUpdate(filter, data, options).lean();
    }

    async findMany<T>(chatId: string, filter: FindChatMessagesFilter, select?: Projection): Promise<T[]> {
        const criteria = { 
            chatId: { $eq: chatId }
        };
        const sort: Record<string, SortOrder> = { createdAt: filter.sort === 'asc' ? 1 : -1 };
        return await this.chatMessageModel
            .find(criteria)
            .select(select || {})
            .sort(sort)
            .skip(filter.offset || 0)
            .limit(filter.limit || 50)
            .lean<T[]>();
    }

}