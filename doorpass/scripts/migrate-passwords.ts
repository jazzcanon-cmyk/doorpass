/**
 * buildings.password → buildings.password_encrypted 마이그레이션 (안전 모드)
 *
 * 처리 케이스:
 *   1) password가 이미 암호화 형식(`<32hex>:<hex>`) + password_encrypted IS NULL
 *      → password 값을 password_encrypted로 "복사"  (재암호화 X)
 *   2) password가 평문 + password_encrypted IS NULL
 *      → encryptPassword(평문) → password_encrypted에 저장
 *   3) password가 라벨("자유출입" / "기타(메모참조)")
 *      → 스킵 (라벨은 access_type으로 표현되므로 password 컬럼에 그대로 둠)
 *
 * 안전 규칙:
 *   - 기존 password 컬럼 값 절대 NULL로 만들지 않음 (복사만, 원본 보존)
 *   - 기본 모드는 dry-run. --apply 플래그를 줘야 실제 UPDATE 실행
 *   - 사전에 백업 테이블이 존재해야 진행. 없으면 SQL을 안내하고 종료
 *
 * 실행 흐름:
 *   1. (사용자) Supabase SQL Editor에서 백업 테이블 생성:
 *        CREATE TABLE buildings_backup_<TS> AS SELECT * FROM buildings;
 *   2. .env.local 또는 환경변수에 BACKUP_TABLE=buildings_backup_<TS> 설정
 *   3. 드라이런:  npx tsx scripts/migrate-passwords.ts
 *   4. 실제 적용: npx tsx scripts/migrate-passwords.ts --apply
 *
 * 필수 env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENCRYPTION_SECRET_KEY (hex 64자 이상)
 *   BACKUP_TABLE (예: buildings_backup_20260505)
 */

import { createClient } from "@supabase/supabase-js"
import { resolve } from "node:path"
import { encryptPassword, isValidEncryptedPassword } from "../lib/encryption"

// ─────────────────────────────────────────────────────────────────────────────
// 0. 백업 테이블 생성 안내 (스크립트 실행 시 가장 먼저 출력)
// ─────────────────────────────────────────────────────────────────────────────
function printBackupInstructions(backupTable: string | undefined) {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const exampleTable = `buildings_backup_${ts}`
  console.log("━".repeat(72))
  console.log("📦 STEP 0 — 백업 테이블 생성 (이 스크립트 실행 전 필수)")
  console.log("━".repeat(72))
  console.log("")
  console.log("Supabase SQL Editor에 아래 SQL을 실행해 백업 테이블을 만드세요:")
  console.log("")
  console.log(`  CREATE TABLE ${backupTable ?? exampleTable} AS SELECT * FROM buildings;`)
  console.log("")
  console.log("그리고 .env.local에 다음 환경변수를 설정하세요:")
  console.log("")
  console.log(`  BACKUP_TABLE=${backupTable ?? exampleTable}`)
  console.log("")
  console.log("━".repeat(72))
  console.log("")
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 환경 로드
// ─────────────────────────────────────────────────────────────────────────────
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(resolve(process.cwd(), file))
  } catch {
    /* 파일 없음 — 무시 */
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const backupTable = process.env.BACKUP_TABLE
const APPLY = process.argv.includes("--apply")
const PAGE_SIZE = 200
const LABEL_VALUES = new Set(["자유출입", "기타(메모참조)"])

printBackupInstructions(backupTable)

if (!supabaseUrl || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.")
  process.exit(1)
}
const encKey = process.env.ENCRYPTION_SECRET_KEY ?? ""
if (encKey.length < 64) {
  console.error(`❌ ENCRYPTION_SECRET_KEY 길이가 부족합니다. (현재 ${encKey.length}자, 64 hex 문자 = 32 byte 필요)`)
  console.error("   .env.local에 hex 64자 이상 키를 설정하세요. 새 키 생성:")
  console.error('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  console.error("   ⚠️ 운영 중인 키가 있다면 그 키와 동일한 값을 써야 기존 암호화 데이터를 복호화할 수 있습니다.")
  process.exit(1)
}
if (!backupTable) {
  console.error("❌ BACKUP_TABLE 환경변수가 비어 있습니다. 위 안내대로 백업 테이블을 먼저 만드세요.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 백업 테이블 존재·정합성 검증
// ─────────────────────────────────────────────────────────────────────────────
async function verifyBackup(): Promise<void> {
  console.log(`🔎 사전 점검: Supabase URL = ${supabaseUrl}`)
  console.log(`   service key 길이: ${serviceKey?.length ?? 0}`)

  // 1) 원본 buildings 테이블 접근 확인 (연결/키 검증)
  const probe = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
  if (probe.error) {
    console.error("❌ buildings 테이블 접근 실패 — 연결/키 문제일 가능성")
    console.error("   raw error:", JSON.stringify(probe.error, null, 2))
    process.exit(1)
  }
  console.log(`✅ buildings 접근 OK — 원본 행 수: ${probe.count ?? 0}`)
  console.log("")

  console.log(`🔎 백업 테이블 검증: ${backupTable}`)
  const { count, error } = await supabase
    .from(backupTable!)
    .select("id", { count: "exact", head: true })

  if (error) {
    console.error(`❌ 백업 테이블 조회 실패`)
    console.error(`   raw error: ${JSON.stringify(error, null, 2)}`)
    console.error("   — 백업 테이블이 존재하지 않거나 PostgREST 캐시에 반영되지 않았을 수 있습니다.")
    console.error("   — Supabase SQL Editor에서 아래 SQL을 실행해 캐시를 리로드해보세요:")
    console.error("       NOTIFY pgrst, 'reload schema';")
    console.error("   — 또는 다음 SQL로 테이블 존재 여부를 직접 확인하세요:")
    console.error(`       SELECT to_regclass('public.${backupTable}');`)
    process.exit(1)
  }

  const { count: srcCount, error: srcErr } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })

  if (srcErr) {
    console.error(`❌ buildings 테이블 조회 실패: ${srcErr.message}`)
    process.exit(1)
  }

  console.log(`   백업 행 수: ${count ?? 0}`)
  console.log(`   원본 행 수: ${srcCount ?? 0}`)
  if ((count ?? 0) < (srcCount ?? 0)) {
    console.warn("⚠️ 백업 행 수가 원본보다 적습니다. 백업 시점 이후 신규 행이 추가됐을 수 있습니다.")
    console.warn("   진행은 가능하지만, 필요시 백업을 새로 만드는 것을 권장합니다.")
  } else {
    console.log("✅ 백업 검증 OK")
  }
  console.log("")
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 마이그레이션 대상 분류
// ─────────────────────────────────────────────────────────────────────────────
type Row = {
  id: number
  password: string | null
  password_encrypted: string | null
}

type Plan =
  | { kind: "skip-label"; id: number; password: string }
  | { kind: "skip-already-encrypted"; id: number }
  | { kind: "skip-empty"; id: number }
  | { kind: "copy"; id: number; encrypted: string }
  | { kind: "encrypt"; id: number; plaintextLen: number; encrypted: string }

function planRow(row: Row): Plan {
  // password_encrypted가 이미 채워진 행은 건드리지 않음
  if (row.password_encrypted && row.password_encrypted.trim() !== "") {
    return { kind: "skip-already-encrypted", id: row.id }
  }
  const raw = (row.password ?? "").trim()
  if (!raw) return { kind: "skip-empty", id: row.id }
  if (LABEL_VALUES.has(raw)) return { kind: "skip-label", id: row.id, password: raw }
  if (isValidEncryptedPassword(raw)) {
    return { kind: "copy", id: row.id, encrypted: raw }
  }
  // 평문으로 간주 → 새로 암호화
  return {
    kind: "encrypt",
    id: row.id,
    plaintextLen: raw.length,
    encrypted: encryptPassword(raw),
  }
}

async function fetchPage(from: number): Promise<Row[]> {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, password, password_encrypted")
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 적용 (옵션)
// ─────────────────────────────────────────────────────────────────────────────
async function applyPlan(plans: Plan[]): Promise<{ ok: number; fail: number }> {
  let ok = 0
  let fail = 0
  for (const p of plans) {
    if (p.kind !== "copy" && p.kind !== "encrypt") continue
    // password 컬럼은 그대로 두고 password_encrypted만 채움 (원본 보존)
    const { error } = await supabase
      .from("buildings")
      .update({ password_encrypted: p.encrypted })
      .eq("id", p.id)
    if (error) {
      console.error(`  [id=${p.id}] 업데이트 실패: ${error.message}`)
      fail += 1
    } else {
      ok += 1
    }
  }
  return { ok, fail }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 메인
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await verifyBackup()

  console.log(`🔍 마이그레이션 계획 수립 (모드: ${APPLY ? "APPLY" : "DRY-RUN"})`)
  console.log("")

  const tally = {
    "skip-already-encrypted": 0,
    "skip-empty": 0,
    "skip-label": 0,
    copy: 0,
    encrypt: 0,
  }
  const actionable: Plan[] = []
  let scanned = 0
  let from = 0

  while (true) {
    const rows = await fetchPage(from)
    if (rows.length === 0) break
    scanned += rows.length
    for (const r of rows) {
      const p = planRow(r)
      tally[p.kind] += 1
      if (p.kind === "copy" || p.kind === "encrypt") actionable.push(p)
    }
    from += PAGE_SIZE
  }

  console.log(`📊 스캔 완료 — 총 ${scanned}건`)
  console.log(`   skip (password_encrypted 이미 있음): ${tally["skip-already-encrypted"]}`)
  console.log(`   skip (password 비어 있음):          ${tally["skip-empty"]}`)
  console.log(`   skip (라벨):                         ${tally["skip-label"]}`)
  console.log(`   복사 대상 (password가 이미 암호화):   ${tally.copy}`)
  console.log(`   암호화 대상 (평문 → 암호화):           ${tally.encrypt}`)
  console.log("")

  if (!APPLY) {
    console.log("ℹ️ 드라이런 모드입니다. 실제 적용하려면 --apply 플래그를 추가해 다시 실행하세요:")
    console.log("   npx tsx scripts/migrate-passwords.ts --apply")
    return
  }

  if (actionable.length === 0) {
    console.log("✨ 적용할 변경 사항이 없습니다.")
    return
  }

  console.log(`✏️ ${actionable.length}건 적용 시작 (password 컬럼은 보존, password_encrypted만 갱신)`)
  const { ok, fail } = await applyPlan(actionable)
  console.log("")
  console.log(`🏁 완료 — 성공 ${ok} / 실패 ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error("💥 스크립트 오류:", err)
  process.exit(1)
})
