import { env } from "../config/env";

const LINE_CONTENT_API = "https://api-data.line.me/v2/bot/message";

/**
 * Download media content from LINE Content API.
 * Returns { buffer, contentType }
 * Note: LINE keeps content for 30 days only.
 */
export async function downloadLineContent(
  messageId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(`${LINE_CONTENT_API}/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download LINE content ${messageId}: ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType };
}
