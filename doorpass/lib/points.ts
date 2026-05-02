import { supabaseAdmin } from '@/lib/supabase-admin'

export const POINT_RULES = {
  building_name: 10,
  building_password: 100,
  building_memo: 50,
  building_free_access: 10,
  building_elevator: 20,
  building_new: 200,
  referral_send: 500,
  referral_receive: 300,
} as const

export type PointAction = keyof typeof POINT_RULES

const DAILY_LIMIT = 5000

export async function addPoints({
  email,
  action,
  buildingId,
  buildingName,
}: {
  email: string
  action: PointAction
  buildingId?: number
  buildingName?: string
}) {
  try {
    const points = POINT_RULES[action]

    const today = new Date().toISOString().slice(0, 10)
    const { data: todayLogs } = await supabaseAdmin
      .from('point_logs')
      .select('points')
      .eq('email', email)
      .gte('created_at', today + 'T00:00:00Z')
      .lte('created_at', today + 'T23:59:59Z')

    const todayTotal = (todayLogs ?? []).reduce((sum, l) => sum + l.points, 0)
    if (todayTotal >= DAILY_LIMIT) return { success: false, reason: 'daily_limit' }

    await supabaseAdmin.from('point_logs').insert({
      email,
      action,
      points,
      building_id: buildingId ?? null,
      building_name: buildingName ?? null,
    })

    const { data: existing } = await supabaseAdmin
      .from('user_points')
      .select('total_points')
      .eq('email', email)
      .single()

    const newTotal = (existing?.total_points ?? 0) + points

    await supabaseAdmin.from('user_points').upsert({
      email,
      total_points: newTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    const prevTotal = existing?.total_points ?? 0
    if (prevTotal < 10000 && newTotal >= 10000) {
      const { sendTelegramMessage } = await import('@/lib/telegram')
      sendTelegramMessage(
        '[DoorPass] 🎉 포인트 1만P 달성!\n👤 회원: ' + email + '\n🏆 누적: ' + newTotal.toLocaleString() + 'P\n💰 GS상품권 1만원 지급 대상입니다!',
        'new_user_notification'
      ).catch(console.error)
    }

    return { success: true, points, newTotal }
  } catch (e) {
    console.error('[points]', e)
    return { success: false, reason: 'error' }
  }
}
