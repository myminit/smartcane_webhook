export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/iot') {
    return handleIOT(request, env);
  }

  if (request.method === 'POST' && url.pathname === '/webhook') {
    return handleLineWebhook(request, env);
  }

  if (url.pathname === '/') {
    return new Response("SmartCane Worker OK");
  }

  return new Response("Not found", { status: 404 });
}

/** HANDLE IOT FALL DATA */
async function handleIOT(request, env) {
  const incomingKey = request.headers.get('x-smartcane-key') || '';
  const WORKER_KEY = env.WORKER_SECRET_KEY;

  if (incomingKey !== WORKER_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const msg = body.message || "";

  if (msg.toLowerCase() === "fall") {
    await sendLinePush("⚠️ ตรวจพบการล้มจากไม้เท้า", env);
  }

  return new Response("OK", { status: 200 });
}

/** HANDLE LINE WEBHOOK */
async function handleLineWebhook(request, env) {
  const body = await request.json();
  const replyToken = body.events?.[0]?.replyToken;

  if (!replyToken) {
    return new Response("OK");
  }

  await sendLineReply(replyToken, "Webhook received!", env);
  return new Response("OK");
}

/** PUSH Message */
async function sendLinePush(text, env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const caregiver = env.LINE_CAREGIVER_ID;

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      to: caregiver,
      messages: [{ type: "text", text }]
    })
  });
}

/** REPLY Message */
async function sendLineReply(replyToken, text, env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });
}
