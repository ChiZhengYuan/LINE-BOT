import { env } from "../config/env.js";

const LINE_API = "https://api.line.me/v2/bot";

export async function replyText(replyToken, text) {
  if (!env.lineChannelAccessToken || !replyToken) {
    return;
  }

  await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.lineChannelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });
}

export async function pushText(to, text) {
  if (!env.lineChannelAccessToken || !to) {
    return;
  }

  await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.lineChannelAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }]
    })
  });
}

export async function getProfile(userId) {
  if (!env.lineChannelAccessToken || !userId) {
    return null;
  }

  const response = await fetch(`${LINE_API}/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${env.lineChannelAccessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}
