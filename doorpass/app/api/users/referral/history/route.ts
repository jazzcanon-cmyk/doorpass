import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = resolveUserEmail(user!)

  const { data: approved } = await supabaseAdmin
    .from('approved_users')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  const isManager = approved?.role === 'admin' || approved?.role === 'sub_admin'

  let query = supabaseAdmin
    .from('referral_tokens')
    .select('id, memo, referrer_email, referred_email, status, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!isManager) {
    query = query.eq('referrer_email', email)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ history: data ?? [] })
}
