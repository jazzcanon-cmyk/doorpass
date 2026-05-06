import webpush from "web-push"
import { supabaseAdmin } from "@/lib/supabase-admin"

let vapidConfigured = false
function ensureVapid() {
  if (vapidConfigured) return
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID 환경변수가 설정되지 않았습니다.")
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

interface SubscriptionRow {
  id: number | string
  user_email: string
  subscription: webpush.PushSubscription
}

interface PushPayload {
  title: string
  body: string
  url?: string
  excludeEmail?: string
}

/**
 * push_subscriptions 테이블의 모든 회원에게 푸시 알림 발송.
 * 410/404 응답 받은 만료 구독은 자동 정리.
 */
export async function sendPushToMembers({
  title,
  body,
  url = "/",
  excludeEmail,
}: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureVapid()

  let q = supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_email, subscription")
  if (excludeEmail) q = q.neq("user_email", excludeEmail)

  const { data: rows, error } = await q
  if (error) {
    console.error("[sendPushToMembers] 구독 조회 실패", error)
    return { sent: 0, failed: 0 }
  }

  const subscriptions = (rows ?? []) as SubscriptionRow[]
  const payload = JSON.stringify({ title, body, url })

  let sent = 0
  let failed = 0
  const staleIds: SubscriptionRow["id"][] = []

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          staleIds.push(row.id)
        } else {
          console.error("[sendPushToMembers] 발송 오류", row.id, err)
        }
        failed += 1
      }
    })
  )

  if (staleIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds)
  }

  return { sent, failed }
}

/**
 * 특정 회원(email)의 모든 구독 디바이스로 푸시 전송.
 * 410/404 만료 구독은 자동 정리.
 */
export async function sendPushToUser(
  email: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  ensureVapid()

  const { data: rows, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_email, subscription")
    .eq("user_email", email)

  if (error) {
    console.error("[sendPushToUser] 구독 조회 실패", error)
    return { sent: 0, failed: 0 }
  }

  const subscriptions = (rows ?? []) as SubscriptionRow[]
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/my-points",
  })

  let sent = 0
  let failed = 0
  const staleIds: SubscriptionRow["id"][] = []

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, body)
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          staleIds.push(row.id)
        } else {
          console.error("[sendPushToUser] 발송 오류", row.id, err)
        }
        failed += 1
      }
    })
  )

  if (staleIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds)
  }

  return { sent, failed }
}
