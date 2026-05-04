import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addPoints } from '@/lib/points'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { token } = await request.json() as { token?: string }
  if (!token) return NextResponse.json({ error: '토큰 없음' }, { status: 400 })

  const email = user!.email!
  const meta = user!.user_metadata as Record<string, unknown> | undefined
  const kakaoName = (meta?.name as string | undefined) ?? (meta?.full_name as string | undefined) ?? ''

  // a. 토큰 유효성 확인
  const { data: ref } = await supabaseAdmin
    .from('referral_tokens')
    .select('id, referrer_email, status, expires_at')
    .eq('token', token)
    .single()

  if (!ref) return NextResponse.json({ error: '유효하지 않은 링크' }, { status: 400 })
  if (ref.status !== 'pending') return NextResponse.json({ error: '이미 사용된 링크' }, { status: 400 })
  if (new Date(ref.expires_at) < new Date()) return NextResponse.json({ error: '만료된 링크' }, { status: 400 })
  if (ref.referrer_email === email) return NextResponse.json({ error: '본인 링크는 사용 불가' }, { status: 400 })

  const referrerEmail: string = ref.referrer_email

  // b. 이미 approved_users에 있으면 → "이미 승인된 회원"
  const { data: existing } = await supabaseAdmin
    .from('approved_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: '이미 승인된 회원' }, { status: 400 })

  // c. 추천인의 branch_id 조회
  const { data: referrer } = await supabaseAdmin
    .from('approved_users')
    .select('branch_id')
    .eq('email', referrerEmail)
    .maybeSingle()

  const branchId = referrer?.branch_id ?? null

  // d. 신청자 approved_users 자동 등록
  const { error: insertError } = await supabaseAdmin
    .from('approved_users')
    .insert({
      email,
      name: kakaoName,
      role: 'driver',
      branch_id: branchId,
      approved_by: `referral:${referrerEmail}`,
      first_login_at: new Date().toISOString(),
    })

  if (insertError) {
    console.error('[referral/use] approved_users 등록 실패', insertError)
    return NextResponse.json({ error: '자동 승인 처리 실패' }, { status: 500 })
  }

  // e. referral_tokens 업데이트
  await supabaseAdmin
    .from('referral_tokens')
    .update({ status: 'used', referred_email: email })
    .eq('id', ref.id)

  // f, g. 포인트 지급 (병렬)
  await Promise.allSettled([
    addPoints({ email: referrerEmail, action: 'referral_send', buildingName: '추천인 보상' }),
    addPoints({ email, action: 'referral_receive', buildingName: '추천 가입 보너스' }),
  ])

  // h, i. 푸시 알림 (병렬, fire-and-forget)
  const baseUrl = new URL(request.url).origin
  Promise.allSettled([
    fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: referrerEmail,
        title: '🎉 추천하신 분이 가입했어요!',
        body: '추천 보상으로 500P가 적립됐어요.',
        url: '/my-points',
      }),
    }),
    fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: email,
        title: '✅ 추천인을 통해 자동 승인됐어요!',
        body: '이제 건물 비밀번호를 확인할 수 있어요. 앱을 열어보세요.',
        url: '/',
      }),
    }),
  ]).catch(console.error)

  return NextResponse.json({ success: true, autoApproved: true })
}
