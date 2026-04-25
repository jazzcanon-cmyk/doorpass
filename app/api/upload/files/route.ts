import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_SIZE = 20 * 1024 * 1024 // 20MB

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'text/plain': 'txt',
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 })
    }

    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: '허용되지 않는 파일 형식입니다. (이미지, PDF, Office 문서, ZIP, TXT)' },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const fileName = `files/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, buffer, { contentType: file.type })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabase.storage.from('post-images').getPublicUrl(fileName)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '업로드 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
