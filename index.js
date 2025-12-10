// index.js - Cloudflare Worker
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  // รองรับเฉพาะ POST /iot
  if (request.method === 'POST' && url.pathname === '/iot') {
    // ตรวจหา shared secret header (ถ้าต้องการป้องกัน abuse)
    const incomingKey = request.headers.get('x-smartcane-key') || '';
    const WORKER_KEY = WORKER_SECRET_KEY; // จะถูกแทนที่จาก Secrets (ดูด้านล่าง)

    if (!WORKER_KEY || incomingKey !== WORKER_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // body.message อาจเป็น string หรือ object (ขึ้นกับแอปของคุณ)
    // หากแอปส่ง { message: "fall" } หรือส่ง JSON event ก็รองรับ
    const msgRaw = body.message ?? body; // ถ้าส่งทั้ง object ให้ใช้ทั้ง object
    // ตัดกรณีที่ message เป็น object event
    let isFall = false;
    let textToSend = '';

    if (typeof msgRaw === 'string') {
      isFall = msgRaw.toLowerCase() === 'fall';
      textToSend = isFall ? 'ผู้ใช้ตรวจพบการล้ม (จากไม้เท้า).' : `Notification: ${msgRaw}`;
    } else if (typeof msgRaw === 'object' && msgRaw !== null) {
      // ถ้าเป็น object event เช่น { type:'event', event:'fall', impact_g:... }
      if ((msgRaw.event || '').toString().toLowerCase() === 'fall') {
        isFall = true;
        const impact = msgRaw.impact_g ?? 'ไม่ทราบ';
        textToSend = `⚠️ ตรวจพบการล้มจากไม้เท้า\nแรงกระแทก: ${impact} G`;
      } else {
        textToSend = `Notification: ${JSON.stringify(msgRaw)}`;
      }
    } else {
      textToSend = `Received: ${String(msgRaw)}`;
    }

    // ถ้าเป็นเหตุการณ์ล้ม → ส่ง LINE
    if (isFall) {
      try {
        await sendLinePush(textToSend);
        return new Response(JSON.stringify({ status: 'ok', action: 'sent_line', text: textToSend }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'line_send_failed', detail: String(err) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ไม่ใช่ fall → เก็บ/รับทราบเฉย ๆ
    return new Response(JSON.stringify({ status: 'ok', action: 'ignored', reason: 'not fall' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // หน้า root / หน้า info
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return new Response('SmartCane Worker running', { status: 200 });
  }

  return new Response('Not found', { status: 404 });
}

/** ส่งข้อความไป LINE push API */
async function sendLinePush(text) {
  // LINE token และ CAREGIVER_ID จะถูกใส่เป็น Secrets (SEE SETUP)
  const LINE_TOKEN = LINE_CHANNEL_ACCESS_TOKEN;
  const CAREGIVER_ID = LINE_CAREGIVER_ID;

  if (!LINE_TOKEN || !CAREGIVER_ID) {
    throw new Error('LINE_TOKEN or CAREGIVER_ID not configured');
  }

  const payload = {
    to: CAREGIVER_ID,
    messages: [
      {
        type: 'text',
        text
      }
    ]
  };

  const resp = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const textBody = await resp.text();
    throw new Error(`LINE push failed: ${resp.status} ${textBody}`);
  }
}
