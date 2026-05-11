import type { User } from "@supabase/supabase-js"

/**
 * 카카오 등 OAuth 로그인 시 user.email이 null/"" 일 수 있음.
 * user_metadata.email → user_metadata.email_address → user.id 순으로 fallback.
 *
 * 서버(API route)와 클라이언트(useAuth 등) 양쪽에서 동일한 식별자를 사용하기 위해
 * 공통 유틸로 분리. lib/auth.ts는 server-only 의존성(next/headers)이 있어
 * 클라이언트 import 불가능하므로 이 파일을 별도로 둠.
 */
export function resolveUserEmail(user: User): string {
  return (
    user.email?.trim() ||
    (user.user_metadata?.email as string | undefined)?.trim() ||
    (user.user_metadata?.email_address as string | undefined)?.trim() ||
    user.id
  )
}
