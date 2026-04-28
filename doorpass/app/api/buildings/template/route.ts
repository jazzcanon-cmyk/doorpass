import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("건물목록")

  ws.columns = [
    { width: 22 },
    { width: 42 },
    { width: 12 },
    { width: 32 },
  ]

  ws.addRows([
    ["name", "address", "password", "memo"],
    ["신정빌딩", "울산광역시 북구 신정동 123-4", "1234#", "현관 우측 키패드"],
    ["현대아파트 101동", "울산광역시 남구 삼산로 456", "5678*", ""],
    ["대우아파트", "울산광역시 동구 동부동 789", "9012!", "메인 출입구"],
  ])

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename*=UTF-8''buildings_template.xlsx",
    },
  })
}
