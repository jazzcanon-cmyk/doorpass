import * as Sentry from "@sentry/nextjs"
import { supabaseAdmin } from "./supabase-admin"
import { fetchWithTimeout } from "./fetch-with-timeout"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

async function isNotificationEnabled(settingKey: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", settingKey)
      .maybeSingle()
    if (!data) return true // 설정 row가 없으면 기본 활성
    return !!data.setting_value
  } catch {
    // admin_settings 테이블이 없거나 접근 불가해도 기본 활성
    return true
  }
}

export async function sendTelegramMessage(text: string, settingKey?: string): Promise<void> {
  if (settingKey) {
    try {
      const enabled = await isNotificationEnabled(settingKey)
      if (!enabled) {
        console.log(`[Telegram] Notification disabled for ${settingKey}`)
        return
      }
    } catch {
      // DB 조회 실패해도 텔레그램 발송은 계속
    }
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.")
    return
  }
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[Telegram] 전송 실패 (${res.status}):`, body)
      Sentry.captureMessage("telegram:send_failed", {
        level: "error",
        tags: { feature: "notification", service: "telegram" },
        extra: { status: res.status, settingKey: settingKey ?? null, response: body },
      })
    }
  } catch (err) {
    console.error("[Telegram] 전송 오류:", err)
    Sentry.captureException(err, {
      tags: { feature: "notification", service: "telegram" },
      extra: { settingKey: settingKey ?? null },
    })
  }
}
