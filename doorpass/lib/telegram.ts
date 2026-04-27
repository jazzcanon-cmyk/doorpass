const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegramMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.")
    return
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    })
    if (!res.ok) {
      console.error(`[Telegram] 전송 실패 (${res.status}):`, await res.text())
    }
  } catch (err) {
    console.error("[Telegram] 전송 오류:", err)
  }
}
