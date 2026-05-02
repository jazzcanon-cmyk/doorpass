import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTelegramMessage } from '@/lib/telegram'

const EXCHANGE_POINTS = 10000

export async function POST() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email!

  // 현재 포인트 확인
  const { data: pointData } = await supabaseAdmin
    .from('user_points')
    .select('total_points')
    .eq('email', email)
    .single()

  const current = pointData?.total_points ?? 0
  if (current < EXCHANGE_POINTS) {
    return NextResponse.json({ error: `포인트가 부족합니다. (현재: ${current}P)` }, { status: 400 })
  }

  const newTotal = current - EXCHANGE_POINTS

  // 포인트 차감
  await supabaseAdmin.from('user_points').update({
    total_points: newTotal,
    updated_at: new Date().toISOString(),
  }).eq('email', email)

  // 교환 로그 추가
  await supabaseAdmin.from('point_logs').insert({
    email,
    action: 'exchange',
    points: -EXCHANGE_POINTS,
    building_name: 'GS상품권 교환',
  })

  // 교환 이력 저장
  await supabaseAdmin.from('point_exchanges').insert({
    email,
    points: EXCHANGE_POINTS,
    status: 'pending',
  })

  // 소장님 텔레그램 알림
  sendTelegramMessage(
    '[DoorPass] 🎁 GS상품권 교환 신청!\n회원: ' + email + '\n차감: 10,000P\n잔여: ' + newTotal.toLocaleString() + 'P\n👉 상품권을 전달해주세요!',
    'new_user_notification'
  ).catch(console.error)

  return NextResponse.json({ success: true, newTotal })
}
