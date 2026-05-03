import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = [
  "/login",
  "/blocked",
  "/terms",
  "/pending-approval",
  "/select-branch",
]

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/auth/")) return true
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set(
    "redirect",
    request.nextUrl.pathname + request.nextUrl.search
  )
  if (reason) url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
  }

  const isAdminPath = pathname.startsWith("/admin")
  const isSubAdminPath = pathname.startsWith("/sub-admin")

  if (!isAdminPath && !isSubAdminPath) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectToLogin(request)
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const email = user.email
  const providerId =
    (user.user_metadata?.provider_id as string | undefined) ??
    (user.user_metadata?.sub as string | undefined)

  let role: string | null = null

  if (email) {
    const { data } = await adminClient
      .from("approved_users")
      .select("role")
      .eq("email", email)
      .maybeSingle()
    role = (data?.role as string | null) ?? null
  }

  if (!role && providerId) {
    const { data } = await adminClient
      .from("approved_users")
      .select("role")
      .eq("kakao_id", providerId)
      .maybeSingle()
    role = (data?.role as string | null) ?? null
  }

  if (isAdminPath && role !== "admin") {
    return redirectToLogin(request, "forbidden")
  }

  if (isSubAdminPath && role !== "admin" && role !== "sub_admin") {
    return redirectToLogin(request, "forbidden")
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
