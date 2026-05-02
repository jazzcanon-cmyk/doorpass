import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count } = await supabaseAdmin
    .from('referral_tokens')
    .select('id', { count: 'exact' })
    .eq('referrer_email', user!.email!)
    .gte('created_at', todayStart.toISOString())

  return NextResponse.json({ remaining: Math.max(0, 3 - (count ?? 0)) })
}
