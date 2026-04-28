import { NextResponse } from "next/server"
import { requireAuth, getUserRole } from "@/lib/auth"

// /api/me 와 동일 정보를 제공하는 alias (사용자 설정 페이지 호환용)
export async function GET() {
  const { user, isAdmin, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  const role = await getUserRole(user!.email)
  return NextResponse.json({
    email: user!.email ?? null,
    role,
    isAdmin,
    canEdit: role === "admin" || role === "editor",
  })
}
