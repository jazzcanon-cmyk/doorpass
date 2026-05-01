import ExcelJS from "exceljs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outPath = join(rootDir, "public", "buildings_template_sub_admin.xlsx")

const workbook = new ExcelJS.Workbook()
const worksheet = workbook.addWorksheet("SubAdminTemplate")

const HEADERS = ["건물명", "주소", "비밀번호", "위도", "경도", "지역", "메모", "출입방식"]
worksheet.addRow(HEADERS)
worksheet.addRow([
  "신정마을아파트",
  "울산 남구 신정동 123",
  "1234",
  35.5384,
  129.3114,
  "울산",
  "1동 출입구",
  "password",
])

worksheet.columns = [
  { width: 18 },
  { width: 36 },
  { width: 14 },
  { width: 12 },
  { width: 12 },
  { width: 12 },
  { width: 24 },
  { width: 12 },
]

await workbook.xlsx.writeFile(outPath)
console.log(`Template created: ${outPath}`)
