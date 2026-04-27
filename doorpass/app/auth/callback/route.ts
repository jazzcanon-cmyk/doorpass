import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { fetchApprovedUserForAuth } from "@/lib/approved-user-match"
import { sendSlackMessage } from "@/lib/slack"

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

  const approved = await fetchApprovedUserForAuth<{ id: string; is_active: boolean }>(
    supabase,
    data.user as User,
    "id, is_active"
  )

  if (approved && approved.is_active === false) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL("/login?error=blocked", origin))
  }

  sendSlackMessage({ text: "👤 사용자 로그인", color: "#22c55e", fields: [{ title: "이메일", value: data.user.email || "알 수 없음", short: true }, { title: "방식", value: String(data.user.app_metadata?.provider || "unknown"), short: true }] }).catch(console.error)

  return NextResponse.redirect(new URL(nextPath, origin))
}
