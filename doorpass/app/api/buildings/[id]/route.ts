import { NextResponse } from "next/server"
import { requireAuth, canEditBuilding } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { encryptPassword, decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"
import { sendTelegramMessage } from "@/lib/telegram"
import { addPoints } from "@/lib/points"

type Params = Promise<{ id: string }>

type BuildingRow = {
  id: number
  name: string | null
  address: string | null
  password: string | null
  password_encrypted: string | null
  memo: string | null
  region: string | null
  created_at: string
  branch_id: string | null
}

function plaintextPassword(raw: string | null): string {
  if (!raw) return ""
  try {
    if (isValidEncryptedPassword(raw)) return decryptPassword(raw)
  } catch {
    /* 평문 저장 레거시 */
  }
  return raw
}

async function assertBuildingAccess(
  userEmail: string,
  buildingId: number
): Promise<{ row: BuildingRow } | { response: NextResponse }> {
  if (!(await canEditBuilding(userEmail))) {
    return {
      response: NextResponse.json(
        { error: "건물 정보 수정 권한이 없습니다. 설정에서 편집자 권한을 요청하세요." },
        { status: 403 }
      ),
    }
  }

  const { data: me } = await supabaseAdmin
    .from("approved_users")
    .select("role, branch_id")
    .eq("email", userEmail)
    .maybeSingle()

  if (!me) {
    return { response: NextResponse.json({ error: "권한 없음" }, { status: 403 }) }
  }

  const { data: row, error } = await supabaseAdmin
    .from("buildings")
    .select("id, name, address, password, password_encrypted, memo, region, created_at, branch_id")
    .eq("id", buildingId)
    .maybeSingle()

  if (error || !row) {
    return { response: NextResponse.json({ error: "건물을 찾을 수 없습니다." }, { status: 404 }) }
  }

  const b = row as BuildingRow
  if (me.role === "sub_admin" && b.branch_id !== me.branch_id) {
    return { response: NextResponse.json({ error: "이 건물을 수정할 권한이 없습니다." }, { status: 403 }) }
  }

  return { row: b }
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "유효하지 않은 건물 ID입니다." }, { status: 400 })
  }

  const access = await assertBuildingAccess(user!.email!, id)
  if ("response" in access) return access.response

  const { row } = access
  return NextResponse.json({
    id: row.id,
    name: row.name ?? row.address?.split(" ").slice(-1)[0] ?? "",
    address: row.address ?? "",
    password: plaintextPassword(row.password_encrypted ?? row.password),
    memo: row.memo ?? "",
    region: row.region,
    created_at: row.created_at,
  })
}

export async function PUT(request: Request, { params }: { params: Params }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "유효하지 않은 건물 ID입니다." }, { status: 400 })
  }

  const access = await assertBuildingAccess(user!.email!, id)
  if ("response" in access) return access.response

  const existingBuilding = access.row

  const { data: userInfo } = await supabaseAdmin
    .from("approved_users")
    .select("role")
    .eq("email", user!.email!)
    .single()
  const userRole = userInfo?.role
  const isManager = userRole === "admin" || userRole === "sub_admin"

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    password?: string | null
    memo?: string | null
  }
  const { name, password, memo } = body

  if (!isManager) {
    const isEmpty = (v: unknown) => v === null || (typeof v === "string" && v.trim() === "")
    if (typeof name === "string" && name.trim() === "") {
      return NextResponse.json({ error: "건물명 삭제는 관리자만 가능합니다." }, { status: 403 })
    }
    if (password !== undefined && isEmpty(password)) {
      return NextResponse.json({ error: "비밀번호 삭제는 관리자만 가능합니다." }, { status: 403 })
    }
    if (memo !== undefined && isEmpty(memo)) {
      return NextResponse.json({ error: "메모 삭제는 관리자만 가능합니다." }, { status: 403 })
    }
  }

  const updateData: Record<string, string | null> = {}
  if (typeof name === "string") updateData.name = name
  if (memo !== undefined) updateData.memo = memo === null ? null : String(memo)
  if (password !== undefined) {
    const p = password
    if (p === null || p === "") {
      updateData.password = null
      updateData.password_encrypted = null
    } else {
      updateData.password = null
      updateData.password_encrypted = encryptPassword(String(p))
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from("buildings").update(updateData).eq("id", id)
    if (error) throw error

    const displayName =
      typeof name === "string"
        ? name
        : (existingBuilding.name ?? existingBuilding.address?.split(" ").slice(-1)[0] ?? "")

    await sendTelegramMessage(
      `✏️ 건물 정보 수정 (관리)\n건물 ID: ${id}\n이름: ${displayName}\n수정자: ${user!.email}`,
      "comment_notification"
    ).catch(console.error)

    if (user?.email && ["editor", "sub_admin", "admin"].includes(userRole ?? "")) {
      const existingPassword = plaintextPassword(existingBuilding.password_encrypted ?? existingBuilding.password)
      const tasks: Promise<unknown>[] = []
      if (name !== undefined && name !== existingBuilding.name) {
        tasks.push(addPoints({ email: user.email, action: "building_name", buildingId: Number(id), buildingName: name }))
      }
      if (password !== undefined && password !== "자유출입" && password !== existingPassword) {
        tasks.push(addPoints({ email: user.email, action: "building_password", buildingId: Number(id), buildingName: name ?? existingBuilding.name ?? undefined }))
      }
      if (password === "자유출입" && existingPassword !== "자유출입") {
        tasks.push(addPoints({ email: user.email, action: "building_free_access", buildingId: Number(id), buildingName: name ?? existingBuilding.name ?? undefined }))
      }
      if (memo !== undefined && memo !== existingBuilding.memo) {
        const hasElevator = memo?.includes("엘리베이터")
        if (hasElevator) {
          tasks.push(addPoints({ email: user.email, action: "building_elevator", buildingId: Number(id), buildingName: name ?? existingBuilding.name ?? undefined }))
        } else {
          tasks.push(addPoints({ email: user.email, action: "building_memo", buildingId: Number(id), buildingName: name ?? existingBuilding.name ?? undefined }))
        }
      }
      Promise.allSettled(tasks).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[buildings PUT]", e)
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data: approvedUser } = await supabaseAdmin
    .from("approved_users")
    .select("role")
    .eq("email", user!.email)
    .maybeSingle()

  if (!approvedUser || (approvedUser.role !== "admin" && approvedUser.role !== "sub_admin")) {
    return NextResponse.json(
      { error: "건물 삭제는 관리자와 부관리자만 가능합니다." },
      { status: 403 }
    )
  }

  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "유효하지 않은 건물 ID입니다." }, { status: 400 })
  }

  const access = await assertBuildingAccess(user!.email!, id)
  if ("response" in access) return access.response

  const label = access.row.name ?? access.row.address ?? `ID ${id}`

  try {
    const { error } = await supabaseAdmin.from("buildings").delete().eq("id", id)
    if (error) throw error

    await sendTelegramMessage(
      `🗑️ 건물 삭제\n건물 ID: ${id}\n이름: ${label}\n삭제자: ${user!.email}`,
      "comment_notification"
    ).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[buildings DELETE]", e)
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 })
  }
}
