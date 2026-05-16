import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { subscription } = body

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: '유효하지 않은 구독 정보' }, { status: 400 })
    }

    const identifier = resolveUserEmail(user!)
    const endpoint = (subscription as { endpoint: string }).endpoint

    // 같은 사용자의 기존 구독 목록에서 동일 endpoint를 찾아 insert/update 분기
    // (onConflict: user_email 로 upsert하면 두 번째 기기가 첫 번째 기기 구독을 덮어씀)
    const { data: userSubs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_email', identifier)

    const existingRow = (userSubs ?? []).find(
      (row) => (row.subscription as { endpoint?: string })?.endpoint === endpoint
    )

    let dbError: unknown
    if (existingRow) {
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .update({ subscription, updated_at: new Date().toISOString() })
        .eq('id', existingRow.id)
      dbError = error
    } else {
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .insert({ user_email: identifier, subscription, updated_at: new Date().toISOString() })
      dbError = error
    }

    if (dbError) {
      console.error('[push/subscribe] DB 오류:', (dbError as Error).message)
      return NextResponse.json({ error: (dbError as Error).message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[push/subscribe] 처리 실패:', (e as Error).message)
    return NextResponse.json({ error: '구독 저장 실패' }, { status: 500 })
  }
}
