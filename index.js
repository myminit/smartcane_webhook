export default {
  async fetch(request, env) {
    console.log("=== Incoming Request ===");
    console.log("URL:", request.url);
    console.log("Method:", request.method);
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
  console.log("=== /iot hit ===");
  console.log("Headers:", JSON.stringify([...request.headers], null, 2));

  const incomingKey = request.headers.get('x-smartcane-key') || '';
  const WORKER_KEY = env.WORKER_SECRET_KEY;

  console.log("Incoming Key:", incomingKey);
  console.log("Expected Key:", WORKER_KEY);

  if (incomingKey !== WORKER_KEY) {
    console.log("Unauthorized: Secret key mismatch");
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  console.log("IOT Body:", body);

  const msg = body.message || "";

  if (msg.toLowerCase() === "fall") {
    console.log("Detected FALL → sending LINE PUSH");
    await sendLinePush("⚠️ ตรวจพบการล้มจากไม้เท้า", env);
  } else {
    console.log("Message not 'fall', ignoring");
  }

  return new Response("OK", { status: 200 });
}

/** HANDLE LINE WEBHOOK */
async function handleLineWebhook(request, env) {
  console.log("=== /webhook hit ===");
  const body = await request.json();
  console.log("Webhook Body:", JSON.stringify(body, null, 2));

  const replyToken = body.events?.[0]?.replyToken;
  console.log("ReplyToken:", replyToken);

  if (!replyToken) {
    console.log("No replyToken, ending.");
    return new Response("OK");
  }

  console.log("Sending reply to LINE");
  await sendLineReply(replyToken, "Webhook received!", env);

  return new Response("OK");
}

/** PUSH Message */
async function sendLinePush(text, env) {
  console.log("=== Sending LINE PUSH ===");

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const caregiver = env.LINE_CAREGIVER_ID;

  console.log("LINE TOKEN:", token ? "[OK Present]" : "[MISSING]");
  console.log("LINE CAREGIVER:", caregiver);

  const payload = {
    to: caregiver,
    messages: [{ type: "text", text }]
  };

  console.log("Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const resultText = await res.text();
  console.log("LINE PUSH RESULT:", res.status, resultText);
}

/** REPLY Message */
async function sendLineReply(replyToken, text, env) {
  console.log("=== Sending LINE REPLY ===");

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;

  console.log("LINE TOKEN:", token ? "[OK Present]" : "[MISSING]");
  console.log("ReplyToken:", replyToken);

  const payload = {
    replyToken,
    messages: [{ type: "text", text }]
  };

  console.log("Reply Payload:", JSON.stringify(payload, null, 2));

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const resultText = await res.text();
  console.log("LINE REPLY RESULT:", res.status, resultText);
}
