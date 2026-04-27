import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.")
}

if (!serviceRoleKey) {
  console.warn(
    "⚠️ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. " +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY로 폴백합니다. " +
    "프로덕션에서는 반드시 SERVICE_ROLE_KEY를 설정하세요."
  )
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)