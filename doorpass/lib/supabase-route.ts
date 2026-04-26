import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/** Route Handler에서 RLS가 적용된 쿼리를 위해 쿠키의 사용자 JWT를 실은 클라이언트 */
export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* 읽기 전용 라우트 */
          }
        },
      },
    }
  )
}
