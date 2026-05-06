import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const { email } = body as { email?: string }

    if (!email) return NextResponse.json({ error: 'email 필요' }, { status: 400 })

    // approved_users에서 삭제
    await supabaseAdmin
      .from('approved_users')
      .delete()
      .eq('email', email)

    // pending_approvals에서도 삭제
    await supabaseAdmin
      .from('pending_approvals')
      .delete()
      .eq('user_email', email)

    // login_history는 유지 (기록 보존)

    void id
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[admin/users:reset-by-id] 초기화 실패:', (e as Error).message)
    return NextResponse.json({ error: '초기화 실패' }, { status: 500 })
  }
}
