import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

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
