import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email!
  const body = await request.json().catch(() => ({})) as { memo?: string }
  const memo = typeof body.memo === 'string' ? body.memo.slice(0, 50).trim() || null : null

  const { data: approved } = await supabaseAdmin
    .from('approved_users')
    .select('id, role')
    .eq('email', email)
    .single()

  if (!approved) {
    return NextResponse.json({ error: '승인된 회원만 추천 링크를 생성할 수 있습니다.' }, { status: 403 })
  }

  const isManager = approved.role === 'admin' || approved.role === 'sub_admin'

  if (!isManager) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count } = await supabaseAdmin
      .from('referral_tokens')
      .select('id', { count: 'exact' })
      .eq('referrer_email', email)
      .gte('created_at', todayStart.toISOString())

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: '오늘 발급 가능한 링크를 모두 사용했습니다. (하루 최대 3개)' }, { status: 429 })
    }
  }

  const token = crypto.randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await supabaseAdmin.from('referral_tokens').insert({
    token,
    referrer_email: email,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
    memo,
  })

  const referralUrl = 'https://doorpass.kr/join?ref=' + token

  return NextResponse.json({ url: referralUrl, expiresAt: expiresAt.toISOString() })
}
