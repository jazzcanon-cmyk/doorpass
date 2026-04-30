import { requireAdmin } from "@/lib/auth"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { AdminLayout } from "./AdminLayout"

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const adminName =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "관리자"
  const adminEmail = user?.email ?? ""

  return (
    <AdminLayout adminName={adminName} adminEmail={adminEmail}>
      {children}
    </AdminLayout>
  )
}
