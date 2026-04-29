import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { fetchApprovedUserForAuth } from "@/lib/approved-user-match"
import { sendTelegramMessage } from "@/lib/telegram"
import { logActivity } from "@/lib/activity-logger"
import { trackActivity } from "@/lib/activity-tracker"
import { supabaseAdmin } from "@/lib/supabase-admin"

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/"
  if (next.includes("..") || next.includes("\\")) return "/"
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextPath = safeNextPath(searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", origin))
  }

  const approved = await fetchApprovedUserForAuth<{
    id: string
    is_active: boolean
    is_blocked: boolean
    blocked_reason: string | null
  }>(supabase, data.user as User, "id, is_active, is_blocked, blocked_reason")

  if (approved?.is_blocked) {
    await supabase.auth.signOut()
    const reason = encodeURIComponent(approved.blocked_reason ?? "")
    return NextResponse.redirect(new URL(`/blocked?reason=${reason}`, origin))
  }

  if (approved && approved.is_active === false) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=blocked", origin))
  }

  sendTelegramMessage(
    `👤 사용자 로그인\n이메일: ${data.user.email || "알 수 없음"}\n방식: ${String(data.user.app_metadata?.provider || "unknown")}`,
    "new_signup_notification"
  ).catch(console.error)
  if (data.user.email) {
    try {
      await supabaseAdmin.from("login_history").insert({ user_email: data.user.email })
    } catch {
      // 로그인 기록 저장 실패는 로그인 자체를 막지 않는다.
    }

    logActivity(data.user.email, "login", {
      provider: data.user.app_metadata?.provider ?? "unknown",
    })
    void trackActivity({
      userEmail: data.user.email,
      actionType: "login",
      targetInfo: {
        provider: data.user.app_metadata?.provider ?? "unknown",
      },
      pageUrl: "/auth/callback",
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
  }

  return NextResponse.redirect(new URL(nextPath, origin))
}
