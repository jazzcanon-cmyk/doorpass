import { supabaseAdmin } from '@/lib/supabase-admin'

export const POINT_RULES = {
  building_name: 10,
  building_password: 100,
  building_memo: 50,
  building_free_access: 10,
  building_elevator: 20,
  building_new: 200,
  building_photo: 50,
  referral_send: 500,
  referral_receive: 300,
  attendance_common_10: 10,
  attendance_common_20: 20,
  attendance_rare: 30,
  attendance_epic: 50,
  attendance_jackpot: 100,
  attendance_bonus_7day: 200,
  attendance_bonus_30day: 1000,
} as const

export type PointAction = keyof typeof POINT_RULES

const DAILY_LIMIT = 5000

type RpcResult = {
  success: boolean
  reason?: string
  points?: number
  newTotal?: number
  prevTotal?: number
}

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

    const { data, error } = await supabaseAdmin.rpc('add_user_points', {
      p_email: email,
      p_action: action,
      p_points: points,
      p_building_id: buildingId ?? null,
      p_building_name: buildingName ?? null,
      p_daily_limit: DAILY_LIMIT,
    })

    if (error) {
      console.error('[points] rpc error:', error)
      return { success: false, reason: 'error' }
    }

    const result = (data ?? {}) as RpcResult
    if (!result.success) {
      return { success: false, reason: result.reason ?? 'unknown' }
    }

    const newTotal = result.newTotal ?? 0
    const prevTotal = result.prevTotal ?? 0
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
