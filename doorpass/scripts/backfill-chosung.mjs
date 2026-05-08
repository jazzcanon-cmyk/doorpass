import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ 환경변수 미설정: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 있어야 합니다.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
]

const NOISE_PATTERN = /[\s\-_.()\[\]]/g

function extractChosung(text) {
  if (!text) return ""
  let result = ""
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00
      const idx = Math.floor(offset / 588)
      result += CHOSUNG[idx]
    } else if (code >= 0x3131 && code <= 0x314e) {
      result += char
    } else {
      result += char
    }
  }
  return result
}

function buildSearchChosung(name, address) {
  const combined = `${name ?? ""} ${address ?? ""}`.trim()
  if (!combined) return ""
  return extractChosung(combined).replace(NOISE_PATTERN, "")
}

async function backfill() {
  const BATCH_SIZE = 1000
  const PARALLEL = 25 // 배치 내부에서 병렬 update 동시성

  console.log("🚀 search_chosung 백필 시작...")
  const startTime = Date.now()

  const { count: totalCount, error: countError } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .is("search_chosung", null)

  if (countError) {
    console.error("❌ 카운트 조회 실패:", countError.message)
    process.exit(1)
  }

  if (!totalCount || totalCount === 0) {
    console.log("✅ 백필 대상이 없습니다 (모두 이미 채워져 있음)")
    return
  }

  console.log(`📊 백필 대상: ${totalCount}건 (BATCH=${BATCH_SIZE}, PARALLEL=${PARALLEL})`)

  let processed = 0
  let totalSuccess = 0
  let totalFailed = 0
  let lastId = 0

  while (true) {
    const { data: batch, error: fetchError } = await supabase
      .from("buildings")
      .select("id, name, address")
      .is("search_chosung", null)
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error("❌ 조회 실패:", fetchError.message)
      break
    }

    if (!batch || batch.length === 0) {
      break
    }

    let batchSuccess = 0
    let batchFailed = 0
    const failedIds = []

    // 동시성 PARALLEL 으로 update
    for (let i = 0; i < batch.length; i += PARALLEL) {
      const slice = batch.slice(i, i + PARALLEL)
      const results = await Promise.all(
        slice.map((row) => {
          const chosung = buildSearchChosung(row.name, row.address)
          return supabase
            .from("buildings")
            .update({ search_chosung: chosung })
            .eq("id", row.id)
            .then(({ error }) => ({ id: row.id, error }))
        })
      )
      for (const r of results) {
        if (r.error) {
          batchFailed++
          if (failedIds.length < 5) failedIds.push(r.id)
        } else {
          batchSuccess++
        }
      }
    }

    processed += batch.length
    totalSuccess += batchSuccess
    totalFailed += batchFailed
    lastId = batch[batch.length - 1].id

    const pct = totalCount ? ((processed / totalCount) * 100).toFixed(1) : "?"
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const failNote = batchFailed > 0 ? ` (실패ID 일부: ${failedIds.join(",")})` : ""
    console.log(
      `  📦 ${processed}/${totalCount} (${pct}%) — 성공:${batchSuccess}, 실패:${batchFailed}, 경과:${elapsed}s${failNote}`
    )

    if (batch.length < BATCH_SIZE) break
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log("")
  console.log(`🎉 완료: 처리 ${processed}건 (성공 ${totalSuccess} / 실패 ${totalFailed}), ${totalElapsed}초`)
  if (totalFailed > 0) {
    console.log(`⚠️  실패가 있으면 동일 명령으로 재실행하면 NULL 인 것만 다시 처리됩니다 (멱등).`)
    process.exit(1)
  }
}

backfill().catch((err) => {
  console.error("💥 치명적 오류:", err)
  process.exit(1)
})
