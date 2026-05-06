import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { decryptPassword, isValidEncryptedPassword } from "@/lib/encryption"

interface BuildingRow {
  id: number
  name: string | null
  address: string | null
  password: string | null
  password_encrypted: string | null
  memo: string | null
  region: string | null
  branch_id: string | null
  access_type: "free" | "password" | "etc" | null
  created_at: string
}

function resolvePassword(b: BuildingRow): string {
  if (b.access_type === "free") return "자유출입"
  if (b.access_type === "etc") return "메모 참조"
  const enc = b.password_encrypted ?? null
  const raw = b.password ?? ""
  try {
    if (enc && isValidEncryptedPassword(enc)) return decryptPassword(enc)
    if (raw && isValidEncryptedPassword(raw)) return decryptPassword(raw)
    return raw
  } catch {
    return raw
  }
}

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { data: me, error: meErr } = await supabaseAdmin
    .from("approved_users")
    .select("role, branch_id")
    .eq("email", user!.email)
    .maybeSingle()

  if (meErr || !me || (me.role !== "admin" && me.role !== "sub_admin")) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 })
  }

  const url = new URL(request.url)
  const branchIdParam = url.searchParams.get("branch_id") ?? null

  // sub_admin은 자신의 branch_id로 고정
  const effectiveBranchId =
    me.role === "sub_admin" ? (me.branch_id as string | null) : branchIdParam

  let rows: BuildingRow[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    let q = supabaseAdmin
      .from("buildings")
      .select("id, name, address, password, password_encrypted, memo, region, branch_id, access_type, created_at")
      .order("address", { ascending: true })
      .range(from, from + pageSize - 1)

    if (effectiveBranchId) {
      q = q.eq("branch_id", effectiveBranchId)
    }

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) break

    rows = rows.concat(data as BuildingRow[])
    if (data.length < pageSize) break
    from += pageSize
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("건물목록")

  ws.columns = [
    { header: "번호",   key: "no",         width: 8  },
    { header: "건물명", key: "name",        width: 24 },
    { header: "주소",   key: "address",     width: 40 },
    { header: "비밀번호", key: "password",  width: 18 },
    { header: "지역",   key: "region",      width: 14 },
    { header: "메모",   key: "memo",        width: 30 },
    { header: "등록일", key: "created_at",  width: 14 },
  ]

  // 헤더 스타일
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    }
  })

  rows.forEach((b, i) => {
    ws.addRow({
      no: i + 1,
      name: b.name ?? "",
      address: b.address ?? "",
      password: resolvePassword(b),
      region: b.region ?? "",
      memo: b.memo ?? "",
      created_at: b.created_at
        ? new Date(b.created_at).toLocaleDateString("ko-KR")
        : "",
    })
  })

  const today = new Date()
  const yyyymmdd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("")
  const label = effectiveBranchId ?? "전체"
  const filename = `buildings_${label}_${yyyymmdd}.xlsx`

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
