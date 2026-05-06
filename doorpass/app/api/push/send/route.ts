import { NextResponse } from "next/server"
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

export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret")
  const expectedSecret = process.env.INTERNAL_API_SECRET

  if (!expectedSecret || expectedSecret.length < 16) {
    console.error("[push/send] INTERNAL_API_SECRET이 설정되지 않았거나 너무 짧습니다.")
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 })
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  }

  let body: { userEmail?: string; title?: string; body?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 })
  }

  const userEmail = body.userEmail?.trim()
  const title = body.title
  const messageBody = body.body
  const url = body.url ?? "/"

  if (!userEmail || !title || messageBody === undefined) {
    return NextResponse.json(
      { error: "userEmail, title, body가 필요합니다." },
      { status: 400 }
    )
  }

  try {
    ensureVapid()
  } catch (e) {
    console.error("[push/send] VAPID 설정 오류:", (e as Error).message)
    return NextResponse.json({ error: "푸시 설정 오류" }, { status: 500 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_email, subscription")
    .eq("user_email", userEmail)

  if (error) {
    console.error("[push/send] 구독 조회 실패:", (error as Error).message)
    return NextResponse.json({ error: "구독 조회 실패" }, { status: 500 })
  }

  const subscriptions = (rows ?? []) as SubscriptionRow[]
  const payload = JSON.stringify({ title, body: messageBody, url })

  let sent = 0
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
          console.error("[push/send] 발송 오류 (id=" + row.id + "):", (err as Error).message)
        }
      }
    })
  )

  if (staleIds.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds)
  }

  return NextResponse.json({ success: true, sent })
}
