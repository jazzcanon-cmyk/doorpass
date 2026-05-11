import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { addPoints, type PointAction } from '@/lib/points'
import { encryptPassword } from '@/lib/encryption'
import { buildSearchChosung } from '@/lib/korean-search'

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

    const isManager = role === 'admin' || role === 'sub_admin'
    const isDeletableField = field === 'name' || field === 'password' || field === 'memo'
    const isEmptyValue = typeof value !== 'string' || value.trim() === ''
    if (!isManager && isDeletableField && isEmptyValue) {
      const fieldLabel =
        field === 'password' ? '비밀번호' : field === 'memo' ? '메모' : '건물명'
      return NextResponse.json(
        { error: `${fieldLabel} 삭제는 관리자만 가능합니다.` },
        { status: 403 }
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('buildings')
      .select('name, address, password, password_encrypted, memo, has_elevator')
      .eq('id', buildingId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: '건물을 찾을 수 없습니다.' }, { status: 404 })
    }

    const updatePayload: Record<string, unknown> =
      field === 'password'
        ? !value || value.trim() === ''
          ? { password: null, password_encrypted: null }
          : { password: null, password_encrypted: encryptPassword(value) }
        : { [field]: value }

    if (field === 'name') {
      updatePayload.search_chosung = buildSearchChosung(value, existing.address)
    }

    const { error: updateError } = await supabaseAdmin
      .from('buildings')
      .update(updatePayload)
      .eq('id', buildingId)

    if (updateError) {
      console.error('[save-field] DB 업데이트 실패:', (updateError as Error).message)
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
    }

    let action: PointAction | null = null

    if (field === 'name') {
      const wasEmpty = !existing.name || existing.name.trim() === ''
      const isNew = value && value.trim() !== ''
      if (wasEmpty && isNew) action = 'building_name'
    } else if (field === 'password') {
      const hadAny =
        (typeof existing.password === 'string' && existing.password.trim() !== '' && existing.password !== '미입력') ||
        (typeof existing.password_encrypted === 'string' && existing.password_encrypted.trim() !== '')
      const wasEmpty = !hadAny
      const isNew = value && value.trim() !== ''
      if (wasEmpty && isNew) {
        action = value === '자유출입' ? 'building_free_access' : 'building_password'
      }
    } else if (field === 'memo') {
      const wasEmpty = !existing.memo || existing.memo.trim() === ''
      const isNew = value && value.trim() !== ''
      if (wasEmpty && isNew) {
        action = value.includes('엘리베이터') ? 'building_elevator' : 'building_memo'
      }
    } else if (field === 'has_elevator') {
      const currentVal = (existing as Record<string, unknown>).has_elevator
      const wasNull = currentVal === null || currentVal === undefined
      if (wasNull) action = 'building_elevator'
    }

    let pointResult: { success: boolean; points?: number; newTotal?: number } = { success: false }
    if (action && user) {
      try {
        pointResult = await addPoints({
          email: resolveUserEmail(user!),
          action,
          buildingId: Number(buildingId),
          buildingName: existing.name ?? '',
        })
      } catch (e) {
        console.error('[save-field] 포인트 적립 오류 (저장은 성공):', (e as Error).message)
      }
    }

    return NextResponse.json({
      success: true,
      points: pointResult.success ? (pointResult.points ?? 0) : 0,
      newTotal: pointResult.success ? (pointResult.newTotal ?? null) : null,
      action,
    })
  } catch (e) {
    console.error('[save-field] 예외 발생:', (e as Error).message)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }
}
