import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addPoints } from '@/lib/points'
import type { PointAction } from '@/lib/points'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as {
      buildingId: string | number
      field: 'name' | 'password' | 'memo'
      value: string
    }
    const { buildingId, field, value } = body

    if (!buildingId || !field || value === undefined) {
      return NextResponse.json({ error: '필수 값 누락' }, { status: 400 })
    }

    const { data: userInfo } = await supabaseAdmin
      .from('approved_users')
      .select('role')
      .eq('email', user!.email!)
      .maybeSingle()

    const role = userInfo?.role as string | null
    if (!role || !['editor', 'sub_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { data: existing } = await supabaseAdmin
      .from('buildings')
      .select('name, password, memo')
      .eq('id', buildingId)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: '건물 없음' }, { status: 404 })

    const { error: updateError } = await supabaseAdmin
      .from('buildings')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', buildingId)

    if (updateError) throw updateError

    let action: PointAction | null = null

    if (field === 'name' && value !== existing.name) {
      action = 'building_name'
    } else if (field === 'password') {
      if (value === '자유출입' && existing.password !== '자유출입') {
        action = 'building_free_access'
      } else if (value !== existing.password && value !== '자유출입') {
        action = 'building_password'
      }
    } else if (field === 'memo' && value !== existing.memo) {
      if (value.includes('엘리베이터')) {
        action = 'building_elevator'
      } else {
        action = 'building_memo'
      }
    }

    let pointResult: { success: boolean; points?: number; newTotal?: number } = { success: false }
    if (action) {
      pointResult = await addPoints({
        email: user!.email!,
        action,
        buildingId: Number(buildingId),
        buildingName: existing.name ?? '',
      })
    }

    return NextResponse.json({
      success: true,
      points: pointResult.success ? (pointResult.points ?? 0) : 0,
      newTotal: pointResult.success ? (pointResult.newTotal ?? null) : null,
      action,
    })
  } catch (e) {
    console.error('[save-field]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
