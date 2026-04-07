import { env } from "../config/env.js";

const LINE_API = "https://api.line.me/v2/bot";

function resolveAccessToken(accessTokenOverride) {
  return String(accessTokenOverride || env.lineChannelAccessToken || "").trim();
}

async function sendLineRequest(path, body, accessTokenOverride) {
  const accessToken = resolveAccessToken(accessTokenOverride);
  if (!accessToken) {
    throw new Error("LINE access token is missing");
  }

  const response = await fetch(`${LINE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`LINE API request failed (${response.status}): ${errorText || response.statusText}`);
  }

  return response;
}

export async function replyText(replyToken, text, accessTokenOverride) {
  if (!replyToken) {
    return;
  }

  await sendLineRequest("/message/reply", {
    replyToken,
    messages: [{ type: "text", text }]
  }, accessTokenOverride);
}

export async function pushText(to, text, accessTokenOverride) {
  if (!to) {
    return;
  }

  await sendLineRequest("/message/push", {
    to,
    messages: [{ type: "text", text }]
  }, accessTokenOverride);
}

export async function getProfile(userId, accessTokenOverride) {
  if (!userId) {
    return null;
  }

  const accessToken = resolveAccessToken(accessTokenOverride);
  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${LINE_API}/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`LINE profile request failed (${response.status}): ${errorText || response.statusText}`);
  }

  return response.json();
}
