import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route'
import { logActivity, getIp } from '@/lib/activity-logger'
import { sendTelegramMessage } from '@/lib/telegram'

const supabase = supabaseAdmin

async function getCurrentUserId(): Promise<string | null> {
  try {
    const client = await createSupabaseRouteHandlerClient()
    const { data: { user } } = await client.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function getPostId(url: string): string | null {
  return new URL(url).pathname.split('/api/posts/')[1]?.split('/')[0] ?? null
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const id = getPostId(request.url)
    if (!id) return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const [commentsResult, currentUserId] = await Promise.all([
      supabase
        .from('comments')
        .select('id, content, author, created_at, like_count')
        .eq('post_id', Number(id))
        .order('created_at', { ascending: true }),
      getCurrentUserId(),
    ])

    const { data: comments, error } = commentsResult
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = comments ?? []
    let likedSet = new Set<number>()
    if (currentUserId && rows.length > 0) {
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', rows.map((c) => c.id))
      if (likes) likedSet = new Set(likes.map((l: { comment_id: number }) => l.comment_id))
    }

    return NextResponse.json({
      comments: rows.map((c) => ({
        ...c,
        like_count: c.like_count ?? 0,
        liked: likedSet.has(c.id),
      })),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const id = getPostId(request.url)
    const { content, author } = await request.json()

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })
    if (!id || id === 'undefined') return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 })

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: Number(id), content, author: author || '익명' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 실제 인증된 사용자 이메일로 로그 기록
    logActivity(
      user!.email!,
      "comment_create",
      { post_id: Number(id), content: String(content || "").slice(0, 50), author: author || "익명" },
      getIp(request)
    )

    ;(async () => {
      const { data: post } = await supabase
        .from('posts')
        .select('title')
        .eq('id', Number(id))
        .single()
      const postTitle = post?.title ?? '(제목 없음)'
      const commentAuthor = author || '익명'
      const preview = String(content || '').slice(0, 50)
      await sendTelegramMessage(
        `💬 새 댓글\n📝 게시글: ${postTitle}\n👤 작성자: ${commentAuthor}\n💬 내용: ${preview}`,
        "card_notification"
      )
    })().catch(console.error)

    return NextResponse.json({ comment: { ...data, like_count: 0, liked: false } })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
