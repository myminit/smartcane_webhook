import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ====== ENVIRONMENT VALUES ======
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;   // ใส่ใน Replit Secrets
const CAREGIVER_ID = process.env.CAREGIVER_USER_ID;         // userId ผู้ดูแล


// ====== ฟังก์ชันส่งข้อความไป LINE ======
async function sendLineMessage(text) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to: CAREGIVER_ID,
        messages: [
          {
            type: "text",
            text: text
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("ส่งข้อความสำเร็จ →", text);
  } catch (err) {
    console.error("❌ ส่ง LINE ไม่สำเร็จ:", err.response?.data || err);
  }
}


// ====== 1) Webhook (เอาไว้ Verify กับ LINE เท่านั้น) ======
app.post("/webhook", (req, res) => {
  res.sendStatus(200); // LINE ต้องได้ status 200
});


// ====== 2) IoT ส่งข้อมูลเข้า endpoint นี้ ======
app.post("/iot", async (req, res) => {
  const msg = req.body.message || "มีการแจ้งเตือนจากไม้เท้า";

  console.log("📡 ได้รับข้อมูลจาก IoT:", msg);

  // ส่งข้อความไปหา ผู้ดูแล ผ่าน LINE Messaging API
  await sendLineMessage(msg);

  res.json({ status: "ok" });
});


// ====== 3) หน้าเปิดเว็บปกติ ======
app.get("/", (req, res) => {
  res.send("Smart Cane Alert Server is running.");
});


// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
});
