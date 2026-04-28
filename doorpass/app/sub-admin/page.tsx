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

function parseCSV(text: string, defaultRegion: string): BuildingRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim())
  if (lines.length <= 1) return []
  return lines.slice(1).map((line) => {
    const v = line.split(",")
    return {
      name: (v[0] ?? "").trim(),
      address: (v[1] ?? "").trim(),
      password: (v[2] ?? "").trim(),
      memo: (v[3] ?? "").trim(),
      latitude: parseFloat(v[4] ?? ""),
      longitude: parseFloat(v[5] ?? ""),
      region: (v[6] ?? "").trim() || defaultRegion,
    }
  })
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

  const downloadTemplate = () => {
    const csv = `건물명,주소,비밀번호,메모,위도,경도,지역
신정마을아파트,울산 남구 신정동 123,1234,1동 출입구,35.5384,129.3114,울산
삼산현대아파트,울산 남구 삼산동 456,5678,정문,35.5398,129.3356,울산`
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "doorpass_template.csv"
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      const buildings = parseCSV(text, me?.managed_region ?? "")

      if (buildings.length === 0) {
        toast.error("파일에 데이터가 없습니다.")
        return
      }

      // 클라이언트 검증
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
              엑셀 템플릿을 다운로드해 건물 정보를 입력한 뒤 업로드하세요.
            </p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              CSV 템플릿 다운로드
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
                  CSV 파일 업로드
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
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
            💡 <strong>팁:</strong> 1,000개 이상도 한 번에 업로드 가능합니다. 자동으로 {BATCH_SIZE}개씩 나눠 처리합니다.
          </div>
        </div>

        <Link href="/" className="inline-block">
          <Button variant="outline">메인으로 돌아가기</Button>
        </Link>
      </div>
    </div>
  )
}
