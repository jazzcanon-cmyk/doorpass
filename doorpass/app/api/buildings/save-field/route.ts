import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addPoints, type PointAction } from '@/lib/points'

const ALLOWED_FIELDS = ['name', 'password', 'memo', 'access_type', 'has_elevator'] as const

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as {
      buildingId: string | number
      field: string
      value: string
    }
    const { buildingId, field, value } = body

    if (!buildingId || !field || value === undefined) {
      return NextResponse.json({ error: '필수 값 누락' }, { status: 400 })
    }

    if (!ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number])) {
      return NextResponse.json({ error: '수정 불가 필드' }, { status: 400 })
    }

    const { data: userInfo } = await supabaseAdmin
      .from('approved_users')
      .select('role')
      .eq('email', user!.email!)
      .maybeSingle()

    const role = userInfo?.role as string | null
    if (!role || !['editor', 'sub_admin', 'admin'].includes(role)) {
      console.warn('[save-field] 권한 없음:', user!.email, 'role:', role)
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
    }

    const { data: existing } = await supabaseAdmin
      .from('buildings')
      .select('name, password, memo')
      .eq('id', buildingId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: '건물을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('buildings')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', buildingId)

    if (updateError) {
      console.error('[save-field] DB 업데이트 실패:', updateError)
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
    }

    console.log('[save-field] 저장 성공:', { email: user!.email, buildingId, field })

    let action: PointAction | null = null

    if (field === 'name' && value && value !== existing.name) {
      action = 'building_name'
    } else if (field === 'password') {
      if (value === '자유출입' && existing.password !== '자유출입') {
        action = 'building_free_access'
      } else if (value && value !== '자유출입' && value !== existing.password) {
        action = 'building_password'
      }
    } else if (field === 'memo' && value && value !== existing.memo) {
      action = value.includes('엘리베이터') ? 'building_elevator' : 'building_memo'
    } else if (field === 'has_elevator') {
      action = 'building_elevator'
    }

    let pointResult: { success: boolean; points?: number; newTotal?: number } = { success: false }
    if (action && user?.email) {
      try {
        pointResult = await addPoints({
          email: user.email,
          action,
          buildingId: Number(buildingId),
          buildingName: existing.name ?? '',
        })
      } catch (e) {
        console.error('[save-field] 포인트 적립 오류 (저장은 성공):', e)
      }
    }

    return NextResponse.json({
      success: true,
      points: pointResult.success ? (pointResult.points ?? 0) : 0,
      newTotal: pointResult.success ? (pointResult.newTotal ?? null) : null,
      action,
    })
  } catch (e) {
    console.error('[save-field] 예외 발생:', e)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }
}
