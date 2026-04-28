import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTelegramMessage } from '@/lib/telegram'
import { requireAuth } from '@/lib/auth'

const supabase = supabaseAdmin

export async function GET() {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, author, created_at, view_count, image_url')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const { title, content, author, image_url, category } = await request.json()
  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('posts')
    .insert({ title, content, author: author || '익명', image_url })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const categoryLabel =
    category === 'notice'    ? '공지사항' :
    category === 'resources' ? '자료실'   : '일반'

  sendTelegramMessage(
    `[신정대리점] 새 게시글\n📋 제목: ${title}\n👤 작성자: ${author || '익명'}\n📁 카테고리: ${categoryLabel}`
  ).catch(console.error)

  return NextResponse.json({ post: data })
}
