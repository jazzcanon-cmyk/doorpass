import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    // 관리자 권한 확인
    const { data: me } = await supabaseAdmin
      .from('approved_users')
      .select('role')
      .eq('email', user!.email!)
      .single()

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 가능합니다.' }, { status: 403 })
    }

    const text = await request.text()
    const body = text ? JSON.parse(text) : {}
    const { approved_id, email } = body as { approved_id?: number | null; email?: string | null }

    if (!approved_id && !email) {
      return NextResponse.json({ error: '회원 정보가 없습니다.' }, { status: 400 })
    }

    // approved_id로 삭제 (카카오 사용자)
    if (approved_id) {
      await supabaseAdmin
        .from('approved_users')
        .delete()
        .eq('id', approved_id)

      await supabaseAdmin
        .from('pending_approvals')
        .delete()
        .eq('id', approved_id)
    }

    // email로 삭제 (구글 사용자)
    if (email) {
      await supabaseAdmin
        .from('approved_users')
        .delete()
        .eq('email', email)

      await supabaseAdmin
        .from('pending_approvals')
        .delete()
        .eq('user_email', email)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[reset user]', e)
    return NextResponse.json({ error: '초기화 실패' }, { status: 500 })
  }
}
