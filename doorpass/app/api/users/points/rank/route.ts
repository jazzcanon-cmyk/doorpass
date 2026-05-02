import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const email = user!.email!

  const { data: allPoints } = await supabaseAdmin
    .from('user_points')
    .select('email, total_points')
    .order('total_points', { ascending: false })

  const totalRank = (allPoints ?? []).findIndex((p) => p.email === email) + 1
  const totalUsers = (allPoints ?? []).length

  const { data: myInfo } = await supabaseAdmin
    .from('approved_users')
    .select('branch_id')
    .eq('email', email)
    .single()

  let branchRank = 0
  let branchUsers = 0

  if (myInfo?.branch_id) {
    const { data: branchMembers } = await supabaseAdmin
      .from('approved_users')
      .select('email')
      .eq('branch_id', myInfo.branch_id)

    const branchEmails = (branchMembers ?? []).map((m: { email: string }) => m.email)
    const { data: branchPoints } = await supabaseAdmin
      .from('user_points')
      .select('email, total_points')
      .in('email', branchEmails)
      .order('total_points', { ascending: false })

    branchRank = (branchPoints ?? []).findIndex((p: { email: string }) => p.email === email) + 1
    branchUsers = branchEmails.length
  }

  return NextResponse.json({ totalRank, totalUsers, branchRank, branchUsers })
}
