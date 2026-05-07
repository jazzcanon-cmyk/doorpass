import crypto from "crypto"
import * as Sentry from "@sentry/nextjs"
import { fetchWithTimeout } from "./fetch-with-timeout"

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return "***-****-" + digits.slice(-4)
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString("hex")
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex")
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

/**
 * Solapi 카카오 알림톡 발송.
 * phone이 없거나 환경변수 미설정 시 조용히 스킵.
 * 발송 실패해도 throw하지 않고 console.error만 남김.
 */
export async function sendAlimtalk(
  phone: string | null | undefined,
  templateId: string,
  variables: Record<string, string>
): Promise<void> {
  if (!phone) return

  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const senderPhone = process.env.SOLAPI_SENDER_PHONE

  if (!apiKey || !apiSecret || !senderPhone) {
    console.warn("[solapi] 환경변수 미설정 — SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_PHONE")
    return
  }

  const to = phone.replace(/\D/g, "")
  const from = senderPhone.replace(/\D/g, "")
  if (to.length < 10) return

  const pfId = process.env.SOLAPI_PF_ID ?? undefined

  try {
    const res = await fetchWithTimeout("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(apiKey, apiSecret),
      },
      body: JSON.stringify({
        message: {
          to,
          from,
          kakaoOptions: {
            ...(pfId ? { pfId } : {}),
            templateId,
            variables,
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[solapi] 알림톡 발송 실패:", JSON.stringify(err))
      Sentry.captureMessage("solapi:alimtalk_send_failed", {
        level: "error",
        tags: { feature: "notification", service: "solapi" },
        extra: { templateId, phoneMasked: maskPhone(phone), status: res.status, response: err },
      })
    }
  } catch (error) {
    console.error("[solapi] 알림톡 발송 오류:", (error as Error).message)
    Sentry.captureException(error, {
      tags: { feature: "notification", service: "solapi" },
      extra: { templateId, phoneMasked: maskPhone(phone) },
    })
  }
}
