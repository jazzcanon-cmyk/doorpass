import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
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

    const identifier = user!.email ?? user!.id

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_email: identifier,
        subscription: subscription,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error('[push/subscribe] DB 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[push/subscribe] 오류:', e)
    return NextResponse.json({ error: '구독 저장 실패' }, { status: 500 })
  }
}
