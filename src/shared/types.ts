export type MessageDirection = "inbound" | "outbound_bot" | "outbound_admin";

export interface ConversationLog {
  lineUserId: string;
  direction: MessageDirection;
  messageType: string;
  content: Record<string, unknown>;
  replyToken?: string;
  sourceType?: string;
  sourceId?: string;
  timestamp: Date;
}

export interface WebhookJobData {
  events: LineWebhookEvent[];
  receivedAt: string;
}

export interface BotReplyJobData {
  lineUserId: string;
  replyToken: string;
  messages: unknown[];
  originalEvent: LineWebhookEvent;
}

export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  replyToken?: string;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: string;
    id: string;
    text?: string;
    contentProvider?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
