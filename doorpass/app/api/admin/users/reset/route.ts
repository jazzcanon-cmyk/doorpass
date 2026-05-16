import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const text = await request.text()
    const body = text ? JSON.parse(text) : {}
    const { approved_id, email, user_id } = body as {
      approved_id?: number | null
      email?: string | null
      user_id?: string | null
    }

    if (!approved_id && !email && !user_id) {
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

    // Supabase Auth user 자체를 삭제 (이메일 없는 카카오 미등록 회원도 처리)
    if (user_id) {
      const { error: deleteAuthError } =
        await supabaseAdmin.auth.admin.deleteUser(user_id)
      if (deleteAuthError) {
        console.error('[admin/users:reset] auth user 삭제 실패:', deleteAuthError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/users:reset] 초기화 실패:', (e as Error).message)
    return NextResponse.json({ error: '초기화 실패' }, { status: 500 })
  }
}
