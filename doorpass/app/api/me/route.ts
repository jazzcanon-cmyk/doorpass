import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET() {
  const { user, isAdmin, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  return NextResponse.json({
    id: user!.id,
    email: user!.email ?? null,
    isAdmin,
  })
}
