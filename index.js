export default {
  async fetch(request, env) {
    // log request ที่เข้ามา เพื่อ debug
    console.log("=== Incoming Request ===");
    console.log("URL:", request.url);
    console.log("Method:", request.method);

    // ส่งต่อไปจัดการตาม route
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);

  // endpoint สำหรับรับข้อมูลจากอุปกรณ์ IoT
  if (request.method === 'POST' && url.pathname === '/iot') {
    return handleIOT(request, env);
  }

  // endpoint สำหรับ LINE webhook
  if (request.method === 'POST' && url.pathname === '/webhook') {
    return handleLineWebhook(request, env);
  }

  // ใช้เช็คว่า worker ทำงานปกติหรือไม่
  if (url.pathname === '/') {
    return new Response("SmartCane Worker OK", { status: 200 });
  }

  // ไม่พบ path ที่ร้องขอ
  return new Response("Not found", { status: 404 });
}

async function handleIOT(request, env) {
  // ถูกเรียกเมื่ออุปกรณ์ยิงมาที่ /iot
  console.log("=== /iot hit ===");

  // อ่าน secret key จาก header เพื่อความปลอดภัย
  const incomingKey = request.headers.get('x-smartcane-key') || '';
  const WORKER_KEY = env.WORKER_SECRET_KEY;

  console.log("Incoming Key:", incomingKey);
  console.log("Expected Key:", WORKER_KEY ? "[OK]" : "[MISSING]");

  // ถ้า key ไม่ตรง ปฏิเสธทันที
  if (incomingKey !== WORKER_KEY) {
    console.log("Unauthorized request");
    return new Response("Unauthorized", { status: 401 });
  }

  let body;
  try {
    // แปลง body เป็น JSON
    body = await request.json();
  } catch (err) {
    console.log("Invalid JSON");
    return new Response("Bad Request", { status: 400 });
  }

  // log ข้อมูลจากอุปกรณ์
  console.log("IOT Body:", JSON.stringify(body, null, 2));

  // อ่านชนิด event ที่อุปกรณ์ส่งมา
  const event = (body.event || "").toLowerCase();

  // ตรวจจับกรณีล้ม
  if (event === "fall") {
    console.log("FALL DETECTED");

    // ค่าที่อุปกรณ์ส่งมา (กัน null)
    const aNorm = body.a_norm_g ?? "N/A";
    const threshold = body.threshold_g ?? "N/A";
    const timestamp = body.timestamp ?? Date.now();

    // สร้างข้อความแจ้งเตือน
    const message =
      `⚠️ ตรวจพบการล้มจากไม้เท้า\n` +
      `แรงกระแทก: ${aNorm} G\n` +
      `Threshold: ${threshold} G\n` +
      `เวลา: ${new Date(timestamp).toLocaleString()}`;

    // ส่งแจ้งเตือนไปยัง LINE caregiver
    await sendLinePush(message, env);
  } else {
    // event อื่น ๆ ไม่ต้องแจ้งเตือน
    console.log("ℹ Event ignored:", event);
  }

  return new Response("OK", { status: 200 });
}

// รับ webhook จาก LINE เมื่อผู้ใช้ทัก bot
async function handleLineWebhook(request, env) {
  console.log("=== /webhook hit ===");

  // อ่านข้อมูลจาก LINE
  const body = await request.json();
  console.log("Webhook Body:", JSON.stringify(body, null, 2));

  // replyToken ใช้สำหรับตอบกลับ
  const replyToken = body?.events?.[0]?.replyToken;
  if (!replyToken) {
    console.log("No replyToken");
    return new Response("OK", { status: 200 });
  }

  // ตอบกลับว่าระบบพร้อมใช้งาน
  await sendLineReply(replyToken, "ระบบ SmartCane พร้อมใช้งาน", env);
  return new Response("OK", { status: 200 });
}

// ส่งข้อความ LINE แบบ push (ไม่ต้องมี replyToken)
async function sendLinePush(text, env) {
  console.log("=== Sending LINE PUSH ===");

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = env.LINE_CAREGIVER_ID;

  // ป้องกัน error หาก config ยังไม่ครบ
  if (!token || !to) {
    console.log("LINE credentials missing");
    return;
  }

  const payload = {
    to,
    messages: [{ type: "text", text }]
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  // log ผลลัพธ์จาก LINE API
  const result = await res.text();
  console.log("LINE PUSH RESULT:", res.status, result);
}

// ส่งข้อความตอบกลับ LINE webhook
async function sendLineReply(replyToken, text, env) {
  console.log("=== Sending LINE REPLY ===");

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log("LINE token missing");
    return;
  }

  const payload = {
    replyToken,
    messages: [{ type: "text", text }]
  };

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  // log ผลการตอบกลับ
  const result = await res.text();
  console.log("LINE REPLY RESULT:", res.status, result);
}
