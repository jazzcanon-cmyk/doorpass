import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/auth'

const supabase = supabaseAdmin

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// 파일 실제 내용(magic bytes)으로 MIME 타입 판별
function detectMimeType(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  // 파일 크기 검증
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }

  // 파일 내용 읽기 (magic bytes 검사용)
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 실제 파일 형식 판별 (클라이언트 제공 MIME 타입 무시)
  const detectedMime = detectMimeType(bytes)
  if (!detectedMime) {
    return NextResponse.json({ error: '허용되지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)' }, { status: 400 })
  }

  const ext = MIME_TO_EXT[detectedMime]
  const fileName = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('post-images')
    .upload(fileName, buffer, { contentType: detectedMime })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from('post-images').getPublicUrl(fileName)
  return NextResponse.json({ url: data.publicUrl })
}
