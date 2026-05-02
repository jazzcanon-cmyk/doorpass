import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  // admin 역할 확인 (is_active/is_blocked 컬럼 없이 role만 조회)
  const { data: me } = await supabaseAdmin
    .from('approved_users')
    .select('role')
    .eq('email', user!.email!)
    .single()

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: '어드민 권한이 필요합니다.' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { email } = body as { email?: string }

    if (!email) return NextResponse.json({ error: 'email 필요' }, { status: 400 })

    await supabaseAdmin.from('approved_users').delete().eq('email', email)
    await supabaseAdmin.from('pending_approvals').delete().eq('user_email', email)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[reset user]', e)
    return NextResponse.json({ error: '초기화 실패' }, { status: 500 })
  }
}
