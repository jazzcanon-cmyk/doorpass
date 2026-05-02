import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false, reason: 'invalid' })

  const { data } = await supabaseAdmin
    .from('referral_tokens')
    .select('status, expires_at, referrer_email')
    .eq('token', token)
    .single()

  if (!data) return NextResponse.json({ valid: false, reason: 'invalid' })
  if (data.status === 'used') return NextResponse.json({ valid: false, reason: 'used' })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' })

  const { data: referrer } = await supabaseAdmin
    .from('approved_users')
    .select('name')
    .eq('email', data.referrer_email)
    .single()

  return NextResponse.json({
    valid: true,
    referrerName: referrer?.name ?? '',
  })
}
