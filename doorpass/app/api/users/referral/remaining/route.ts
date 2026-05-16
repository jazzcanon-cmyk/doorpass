import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = resolveUserEmail(user!)
  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const providerId = meta?.provider_id as string | undefined

  // email 우선, kakao_id fallback으로 role 조회
  let approved: { role: string | null } | null = null
  if (email) {
    const { data } = await supabaseAdmin
      .from('approved_users')
      .select('role')
      .eq('email', email)
      .maybeSingle()
    approved = data
  }
  if (!approved && providerId) {
    const { data } = await supabaseAdmin
      .from('approved_users')
      .select('role')
      .eq('kakao_id', providerId)
      .maybeSingle()
    approved = data
  }

  // 관리자/부관리자는 무제한 (클라이언트 제한 없앰)
  if (approved?.role === 'admin' || approved?.role === 'sub_admin') {
    return NextResponse.json({ remaining: 999 })
  }

  const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const todayStart = new Date(`${kstDate}T00:00:00+09:00`)

  const { count } = await supabaseAdmin
    .from('referral_tokens')
    .select('id', { count: 'exact' })
    .eq('referrer_email', email)
    .gte('created_at', todayStart.toISOString())

  return NextResponse.json({ remaining: Math.max(0, 3 - (count ?? 0)) })
}
