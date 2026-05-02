import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { token } = await request.json() as { token?: string }
  if (!token) return NextResponse.json({ error: '토큰 없음' }, { status: 400 })

  const email = user!.email!

  const { data: ref } = await supabaseAdmin
    .from('referral_tokens')
    .select('id, referrer_email, status, expires_at')
    .eq('token', token)
    .single()

  if (!ref) return NextResponse.json({ error: '유효하지 않은 링크' }, { status: 400 })
  if (ref.status !== 'pending') return NextResponse.json({ error: '이미 사용된 링크' }, { status: 400 })
  if (new Date(ref.expires_at) < new Date()) return NextResponse.json({ error: '만료된 링크' }, { status: 400 })
  if (ref.referrer_email === email) return NextResponse.json({ error: '본인 링크는 사용 불가' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('approved_users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) return NextResponse.json({ error: '이미 가입된 회원' }, { status: 400 })

  await supabaseAdmin
    .from('referral_tokens')
    .update({ referred_email: email })
    .eq('id', ref.id)

  return NextResponse.json({ success: true })
}
