import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSlackMessage } from '@/lib/slack'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, author, created_at, view_count, image_url')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(request: Request) {
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

  sendSlackMessage({
    text: `📝 [신정대리점] 새 게시글`,
    color: '#36a64f',
    fields: [
      { title: '제목', value: title, short: false },
      { title: '작성자', value: author || '익명' },
      { title: '카테고리', value: category || '일반' },
      { title: '링크', value: 'https://doorpass.kr', short: false },
    ],
  }).catch((err) => console.error('[Slack] 게시글 알림 전송 실패:', err))

  return NextResponse.json({ post: data })
}
