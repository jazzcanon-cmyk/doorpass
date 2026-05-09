import type { SupabaseClient, User } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

/** 카카오 연동 시 JWT/identities에 들어올 수 있는 후보 ID를 모두 모은다 (DB kakao_id와 하나라도 맞으면 승인) */
export function collectKakaoIdCandidates(user: User): string[] {
  const set = new Set<string>()
  const push = (v: unknown) => {
    if (v == null || v === "") return
    const s = String(v).trim()
    if (s) set.add(s)
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined
  if (meta) {
    push(meta.provider_id)
    push(meta.providerId)
    push(meta.sub)
    push(meta.kakao_id)
  }

  for (const ident of user.identities ?? []) {
    if (ident.provider !== "kakao") continue
    const d = ident.identity_data as Record<string, unknown> | undefined
    if (!d) continue
    push(d.sub)
    push(d.provider_id)
    push(d.providerId)
  }

  return [...set]
}

export function userMatchEmail(user: User): string | undefined {
  const raw =
    user.email ??
    (user.user_metadata as Record<string, unknown> | undefined)?.email ??
    (user.user_metadata as Record<string, unknown> | undefined)?.email_address
  if (typeof raw !== "string") return undefined
  const t = raw.trim().toLowerCase()
  return t || undefined
}

/** 예전 데이터: kakao_id 컬럼에 이메일을 넣은 경우 — JWT에 나온 이메일 후보로 매칭 */
export function collectJwtEmailCandidates(user: User): string[] {
  const set = new Set<string>()
  const push = (v: unknown) => {
    if (v == null || v === "") return
    const s = String(v).trim()
    if (!s.includes("@")) return
    set.add(s)
    set.add(s.toLowerCase())
  }
  push(user.email)
  const meta = user.user_metadata as Record<string, unknown> | undefined
  if (meta) {
    push(meta.email)
    push(meta.email_address)
  }
  return [...set]
}

function projectApprovedRow(row: Record<string, unknown>, columns: string): Record<string, unknown> {
  const keys = columns
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (k in row) out[k] = row[k]
  }
  return out
}

/** JWT에서 온 식별자만 사용 (클라이언트 입력 없음). service_role로 RLS 없이 조회. */
async function queryApprovedWithClient<T extends Record<string, unknown>>(
  client: SupabaseClient,
  user: User,
  columns: string
): Promise<T | null> {
  const provider = user.app_metadata?.provider as string | undefined

  if (provider === "kakao") {
    for (const kid of collectKakaoIdCandidates(user)) {
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("kakao_id", kid)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    for (const jwtEmail of collectJwtEmailCandidates(user)) {
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("kakao_id", jwtEmail)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    const email = userMatchEmail(user)
    if (email) {
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("email", email)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    if (user.email?.trim()) {
      const raw = user.email.trim()
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("email", raw)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    return null
  }

  if (provider === "google") {
    const email = userMatchEmail(user)
    if (email) {
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("email", email)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    const raw = user.email?.trim()
    if (raw) {
      const { data } = await client
        .from("approved_users")
        .select(columns)
        .eq("email", raw)
        .maybeSingle()
      if (data) return data as unknown as T
    }
    return null
  }

  return null
}

/**
 * OAuth 직후·세션 기준으로 approved_users 한 행 조회(있으면).
 * 차단 목록: 행이 있고 is_active=false이면 앱에서 접근 거부. 행이 없으면 일반 사용자로 허용.
 * 1) SUPABASE_SERVICE_ROLE_KEY: 서버 전용, JWT에서 뽑은 식별자로만 테이블 조회 (RLS 우회).
 * 2) DB 함수 resolve_approved_user_for_me(): SECURITY DEFINER — RLS·마이그레이션 미적용 환경에서도 행 조회.
 * 3) 마지막으로 사용자 JWT 클라이언트로 테이블 직접 조회.
 */
export async function fetchApprovedUserForAuth<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  user: User,
  columns: string
): Promise<T | null> {
  const row = await queryApprovedWithClient<T>(supabaseAdmin, user, columns)
  if (row) return row

  const { data: rpcData, error: rpcErr } = await supabase.rpc("resolve_approved_user_for_me")
  if (
    !rpcErr &&
    rpcData !== null &&
    rpcData !== undefined &&
    typeof rpcData === "object" &&
    !Array.isArray(rpcData)
  ) {
    return projectApprovedRow(rpcData as Record<string, unknown>, columns) as unknown as T
  }

  return queryApprovedWithClient<T>(supabase, user, columns)
}
