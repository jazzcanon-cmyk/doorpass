import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = resolveUserEmail(user!)

  const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const todayStart = new Date(`${kstDate}T00:00:00+09:00`)

  const { count } = await supabaseAdmin
    .from('referral_tokens')
    .select('id', { count: 'exact' })
    .eq('referrer_email', email)
    .gte('created_at', todayStart.toISOString())

  return NextResponse.json({ count: count ?? 0 })
}
