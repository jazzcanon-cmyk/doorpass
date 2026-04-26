import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { requireAdminApi } from "@/lib/auth"

export async function GET() {
  const { unauthorized } = await requireAdminApi()
  if (unauthorized) return unauthorized

  const wb = XLSX.utils.book_new()

  const data = [
    ["건물명", "주소", "비밀번호", "층수", "호수", "메모"],
    ["신정빌딩", "울산광역시 북구 신정동 123-4", "1234#", "3", "205", "현관 우측 키패드"],
    ["현대아파트 101동", "울산광역시 남구 삼산로 456", "5678*", "5", "101", ""],
    ["대우아파트", "울산광역시 동구 동부동 789", "9012!", "2", "302", "메인 출입구"],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!cols"] = [
    { wch: 22 }, { wch: 42 }, { wch: 12 },
    { wch: 8  }, { wch: 8  }, { wch: 32 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, "건물목록")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename*=UTF-8\'\'buildings_template.xlsx',
    },
  })
}
