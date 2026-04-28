import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { fetchApprovedUserForAuth } from '@/lib/approved-user-match'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

export async function POST() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const cookieStore = await cookies()
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* 읽기전용 */ }
        },
      },
    }
  )

  const approved = await fetchApprovedUserForAuth<{ id: string }>(
    supabaseUser,
    user as User,
    'id'
  )

  if (!approved) {
    return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('approved_users')
    .update({ welcome_shown: true })
    .eq('id', approved.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const cookieStore = await cookies()
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* 읽기전용 */ }
        },
      },
    }
  )

  const approved = await fetchApprovedUserForAuth<{ welcome_shown: boolean }>(
    supabaseUser,
    user as User,
    'welcome_shown'
  )

  return NextResponse.json({ welcome_shown: approved?.welcome_shown ?? true })
}
