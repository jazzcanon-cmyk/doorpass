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
  canEdit: boolean
}

interface BuildingRow {
  name: string
  address: string
  password: string
  memo: string
  latitude: number
  longitude: number
  region: string
}

const BATCH_SIZE = 200
const HEADERS = ["건물명", "주소", "비밀번호", "메모", "위도", "경도", "지역"] as const

async function parseExcel(file: File, defaultRegion: string): Promise<BuildingRow[]> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []

  const rows: BuildingRow[] = []
  // 1행은 헤더, 2행부터 데이터
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const cell = (n: number) => row.getCell(n).value
    const text = (n: number) => {
      const v = cell(n)
      if (v == null) return ""
      if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "")
      return String(v)
    }
    const num = (n: number) => {
      const v = cell(n)
      if (typeof v === "number") return v
      const parsed = parseFloat(String(v ?? ""))
      return isNaN(parsed) ? NaN : parsed
    }
    rows.push({
      name: text(1).trim(),
      address: text(2).trim(),
      password: text(3).trim(),
      memo: text(4).trim(),
      latitude: num(5),
      longitude: num(6),
      region: text(7).trim() || defaultRegion,
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
  ws.addRow(["삼산현대아파트", "울산 남구 삼산동 456", "5678", "정문", 35.5398, 129.3356, "울산"])
  ws.columns = HEADERS.map(() => ({ width: 20 }))
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "doorpass_template.xlsx"
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function SubAdminPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [me, setMe] = useState<MeInfo & { managed_region?: string | null; name?: string | null } | null>(null)
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

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate()
    } catch (err) {
      console.error(err)
      toast.error("템플릿 생성에 실패했습니다.")
    }
  }

  const parseFile = async (file: File): Promise<BuildingRow[]> => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "xlsx" || ext === "xls") {
      return parseExcel(file, me?.managed_region ?? "")
    }
    throw new Error("Excel 파일(.xlsx, .xls)만 업로드 가능합니다.")
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const buildings = await parseFile(file)

      if (buildings.length === 0) {
        toast.error("파일에 데이터가 없습니다.")
        return
      }

      const invalid = buildings.findIndex(
        (b) => !b.name || !b.address || isNaN(b.latitude) || isNaN(b.longitude)
      )
      if (invalid >= 0) {
        toast.error(`행 ${invalid + 2}: 필수 필드(건물명/주소/위도/경도)가 비어있거나 잘못되었습니다.`)
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
            batchInfo: {
              currentBatch: i + 1,
              totalBatches: batches.length,
              isLastBatch: isLast,
              totalCount: buildings.length,
            },
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ?? `배치 ${i + 1} 업로드 실패`)

        uploaded += batch.length
        setProgress({ current: uploaded, total: buildings.length })
        if (!isLast) await new Promise((r) => setTimeout(r, 500))
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4 text-white">
        <div className="bg-white/10 border border-white/20 rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">💻</div>
          <h2 className="text-2xl font-bold mb-3">PC에서 접속해주세요</h2>
          <p className="text-white/60 mb-6">
            건물 데이터 업로드는 PC 환경에서만 가능합니다.
            <br />
            PC로 접속해주세요.
          </p>
          <Link href="/" className="inline-block">
            <Button variant="outline">메인으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!me) return null

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-bold">부관리자 화면</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">건물 데이터 일괄 업로드</h2>
          <p className="text-white/60 text-sm">
            {me.email}{me.managed_region ? ` · 관리 지역: ${me.managed_region}` : ""}
          </p>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 mb-6 backdrop-blur-sm space-y-5">
          <div>
            <p className="text-white/80 mb-3 text-sm">
              Excel 템플릿을 다운로드해 건물 정보를 입력한 뒤 업로드하세요.
            </p>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Excel 템플릿 다운로드
            </Button>
          </div>

          <div className="border-t border-white/10 pt-5">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  업로드 중... ({progress.current}/{progress.total})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  엑셀 파일 업로드
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileChange}
              disabled={uploading}
              className="hidden"
            />

            {uploading && progress.total > 0 && (
              <div className="mt-4">
                <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-white/60 text-xs mt-2">{percent}% 완료</p>
              </div>
            )}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-200">
            💡 <strong>팁:</strong> Excel 파일(.xlsx, .xls)만 지원합니다. 한 번에 1,000개 이상도 업로드 가능합니다. (자동으로 {BATCH_SIZE}개씩 처리)
          </div>
        </div>

        <Link href="/" className="inline-block">
          <Button variant="outline">메인으로 돌아가기</Button>
        </Link>
      </div>
    </div>
  )
}
