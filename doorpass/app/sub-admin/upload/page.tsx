"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Download, Upload, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface MeInfo {
  role: string
  email: string | null
  isAdmin: boolean
}

interface BuildingRow {
  name: string
  address: string
  password: string
  memo: string
  lat: number
  lng: number
  region: string
}

const BATCH_SIZE = 200
const HEADERS = ["건물명", "주소", "비밀번호", "메모", "위도", "경도", "지역"] as const

function displayNameFromAddress(address: string): string {
  const t = address.trim()
  if (!t) return ""
  const parts = t.split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] ?? t
}

async function parseExcel(file: File, defaultRegion: string): Promise<BuildingRow[]> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []

  const rows: BuildingRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const text = (n: number) => String(row.getCell(n).text ?? "").trim()
    const num = (n: number) => {
      const c = row.getCell(n)
      const v = c.value
      if (v === undefined || v === null || v === "") return NaN
      if (typeof v === "number") return v
      const parsed = parseFloat(String(c.text ?? v).trim())
      return Number.isNaN(parsed) ? NaN : parsed
    }
    const address = text(2)
    const rawName = text(1)
    rows.push({
      name: rawName || displayNameFromAddress(address),
      address,
      password: text(3),
      memo: text(4),
      lat: num(5),
      lng: num(6),
      region: text(7) || defaultRegion,
    })
  })
  return rows
}

async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Buildings")
  ws.addRow(HEADERS as unknown as string[])
  ws.addRow(["신정마을아파트", "울산 남구 신정동 123", "1234", "1동 출입구", 35.5384, 129.3114, "울산"])
  ws.columns = HEADERS.map(() => ({ width: 20 }))
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "doorpass_template.xlsx"
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function SubAdminUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [me, setMe] = useState<(MeInfo & { managed_region?: string | null; name?: string | null }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          router.replace("/login")
          return
        }
        if (data.role !== "admin" && data.role !== "sub_admin") {
          router.replace("/settings")
          return
        }
        setMe(data)
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false))
  }, [router])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const buildings = await parseExcel(file, me?.managed_region ?? "")
      if (buildings.length === 0) {
        toast.error("파일에 데이터가 없습니다.")
        return
      }

      const batches: BuildingRow[][] = []
      for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
        batches.push(buildings.slice(i, i + BATCH_SIZE))
      }

      setProgress({ current: 0, total: buildings.length })
      let uploaded = 0
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const isLast = i === batches.length - 1
        const res = await fetch("/api/buildings/upload-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buildings: batch,
            isLastBatch: isLast,
            batchInfo: { currentBatch: i + 1, totalBatches: batches.length, isLastBatch: isLast, totalCount: buildings.length },
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ?? `배치 ${i + 1} 업로드 실패`)
        uploaded += batch.length
        setProgress({ current: uploaded, total: buildings.length })
      }

      toast.success(`총 ${buildings.length}개 건물이 등록되었습니다.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패")
    } finally {
      setUploading(false)
      setProgress({ current: 0, total: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (loading) return <div className="p-6">로딩 중...</div>
  if (isMobile) return <div className="p-6">PC에서 접속해주세요.</div>
  if (!me) return null

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="p-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Link href="/sub-admin" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">건물 데이터 일괄 업로드</h1>
        </div>
      </header>

      <div className="bg-white dark:bg-gray-800 border rounded-2xl p-6 space-y-5">
        <p className="text-sm text-gray-700 dark:text-gray-300">Excel 템플릿을 다운로드해 건물 정보를 입력한 뒤 업로드하세요.</p>
        <Button onClick={() => void downloadTemplate()} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Excel 템플릿 다운로드
        </Button>
        <div className="border-t pt-5">
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? `업로드 중... (${progress.current}/${progress.total})` : "엑셀 파일 업로드"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} disabled={uploading} className="hidden" />
          {uploading && progress.total > 0 && (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">{percent}% 완료</div>
          )}
        </div>
      </div>
    </div>
  )
}
