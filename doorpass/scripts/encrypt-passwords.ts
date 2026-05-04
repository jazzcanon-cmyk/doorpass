/**
 * 평문 비밀번호 일괄 암호화 스크립트
 *
 * buildings 테이블에서 password 컬럼에 평문이 남아있고
 * password_encrypted 컬럼이 비어있는 행을 찾아
 * password 값을 AES-256-CBC로 암호화하여 password_encrypted에 저장하고
 * password 컬럼은 NULL로 초기화한다.
 *
 * 실행:
 *   npx tsx scripts/encrypt-passwords.ts
 *
 * 필수 env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENCRYPTION_SECRET_KEY (hex, 64자 이상)
 */

import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'
import { encryptPassword } from '../lib/encryption'

// Node 21.7+ 내장 env 로더. 파일 없으면 무시.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(resolve(process.cwd(), file))
  } catch {
    // 파일 없음 — 무시
  }
}

const BATCH_SIZE = 100

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

if (!process.env.ENCRYPTION_SECRET_KEY) {
  console.error('❌ ENCRYPTION_SECRET_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Row = { id: number; password: string | null }

async function fetchBatch(): Promise<Row[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('id, password')
    .not('password', 'is', null)
    .is('password_encrypted', null)
    .limit(BATCH_SIZE)

  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

async function processRow(row: Row): Promise<'ok' | 'skip' | 'fail'> {
  const plain = (row.password ?? '').trim()
  if (!plain) {
    const { error } = await supabase
      .from('buildings')
      .update({ password: null })
      .eq('id', row.id)
    return error ? 'fail' : 'skip'
  }

  let encrypted: string
  try {
    encrypted = encryptPassword(plain)
  } catch (e) {
    console.error(`  [id=${row.id}] 암호화 실패:`, e)
    return 'fail'
  }

  const { error } = await supabase
    .from('buildings')
    .update({ password_encrypted: encrypted, password: null })
    .eq('id', row.id)

  if (error) {
    console.error(`  [id=${row.id}] 업데이트 실패:`, error.message)
    return 'fail'
  }
  return 'ok'
}

async function main() {
  console.log('🔐 평문 비밀번호 일괄 암호화 시작')
  console.log(`   배치 크기: ${BATCH_SIZE}건`)

  let totalOk = 0
  let totalSkip = 0
  let totalFail = 0
  let batchIndex = 0

  while (true) {
    const rows = await fetchBatch()
    if (rows.length === 0) break

    batchIndex += 1
    console.log(`\n📦 배치 ${batchIndex} — ${rows.length}건 처리 중...`)

    let okInBatch = 0
    for (const row of rows) {
      const result = await processRow(row)
      if (result === 'ok') {
        totalOk += 1
        okInBatch += 1
      } else if (result === 'skip') {
        totalSkip += 1
      } else {
        totalFail += 1
      }
    }

    console.log(
      `   ✅ 배치 완료: 성공 ${okInBatch} / 누적 성공 ${totalOk} · 스킵 ${totalSkip} · 실패 ${totalFail}`
    )

    // 한 배치에서 한 건도 진행 못하면 무한루프 방지
    if (okInBatch === 0 && rows.length === BATCH_SIZE) {
      console.warn('⚠️ 진행되지 않는 배치 감지 — 종료합니다. 실패 로그를 확인하세요.')
      break
    }
  }

  console.log('\n🏁 작업 종료')
  console.log(`   총 성공: ${totalOk}건`)
  console.log(`   총 스킵: ${totalSkip}건`)
  console.log(`   총 실패: ${totalFail}건`)

  process.exit(totalFail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('💥 스크립트 오류:', err)
  process.exit(1)
})
