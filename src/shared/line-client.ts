import { messagingApi } from "@line/bot-sdk";
import { env } from "../config/env";
import { getQueue } from "../worker/queue";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

/**
 * Reply to a LINE message and log the outbound message to the DB writer queue.
 */
export async function replyAndLog(
  replyToken: string,
  messages: messagingApi.Message[],
  lineUserId: string
): Promise<void> {
  await client.replyMessage({ replyToken, messages });

  const dbQueue = getQueue("db-writer");
  await dbQueue.add("log-outbound", {
    lineUserId,
    direction: "outbound_bot" as const,
    messageType: messages[0]?.type ?? "unknown",
    content: messages,
    timestamp: new Date().toISOString(),
  });
}

export { client as lineClient };
