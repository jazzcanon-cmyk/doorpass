import { NextResponse } from 'next/server'
import { requireAuth, resolveUserEmail } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = resolveUserEmail(user!)

  const [pointRes, logRes] = await Promise.all([
    supabaseAdmin.from('user_points').select('total_points').eq('email', email).maybeSingle(),
    supabaseAdmin.from('point_logs').select('id, email, points, reason, created_at').eq('email', email).order('created_at', { ascending: false }).limit(100),
  ])

  return NextResponse.json({
    total_points: pointRes.data?.total_points ?? 0,
    logs: logRes.data ?? [],
  })
}
