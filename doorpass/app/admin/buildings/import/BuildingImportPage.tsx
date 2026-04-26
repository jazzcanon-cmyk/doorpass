"use client"

import { useState, useRef, useCallback } from "react"
import * as XLSX from "xlsx"
import { Download, Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, SkipForward } from "lucide-react"

interface PreviewRow {
  건물명: string
  주소: string
  비밀번호: string
  층수: string
  호수: string
  메모: string
}

interface ImportError { row: number; address: string; reason: string }
interface ImportResult {
  total: number
  success: number
  updated: number
  skipped: number
  failed: number
  errors: ImportError[]
}

const HEADERS = ["건물명", "주소", "비밀번호", "층수", "호수", "메모"] as const

function parseExcel(buffer: ArrayBuffer): PreviewRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
  return rows.slice(1)
    .filter(row => Array.isArray(row) && row.some(c => c !== "" && c !== undefined && c !== null))
    .map(row => {
      const r = row as (string | number | undefined)[]
      return {
        건물명:   String(r[0] ?? ""),
        주소:     String(r[1] ?? ""),
        비밀번호: String(r[2] ?? ""),
        층수:     String(r[3] ?? ""),
        호수:     String(r[4] ?? ""),
        메모:     String(r[5] ?? ""),
      }
    })
}

function downloadErrorLog(errors: ImportError[]) {
  const wb = XLSX.utils.book_new()
  const data = [
    ["행 번호", "주소", "오류 사유"],
    ...errors.map(e => [e.row, e.address, e.reason]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws["!cols"] = [{ wch: 8 }, { wch: 42 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws, "오류목록")
  XLSX.writeFile(wb, "import_errors.xlsx")
}

export function BuildingImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError("Excel 파일(.xlsx, .xls)만 업로드 가능합니다.")
      return
    }
    setError(null)
    setResult(null)
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const rows = parseExcel(e.target!.result as ArrayBuffer)
        setPreview(rows)
      } catch {
        setError("파일을 파싱할 수 없습니다. 템플릿 형식을 확인해주세요.")
      }
    }
    reader.readAsArrayBuffer(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append("file", file)
      form.append("duplicateAction", duplicateAction)

      const res = await fetch("/api/buildings/import", { method: "POST", body: form })
      const json = await res.json() as ImportResult & { error?: string }

      if (!res.ok) {
        setError(json.error ?? "서버 오류가 발생했습니다.")
        return
      }
      setResult(json)
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">건물 Excel 일괄 등록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Excel 파일로 건물을 한 번에 등록합니다</p>
        </div>
        <a
          href="/api/buildings/template"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          템플릿 다운로드
        </a>
      </div>

      {/* 드래그앤드롭 영역 */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-border hover:border-blue-400 hover:bg-white/5"
          }`}
        >
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-1">Excel 파일을 드래그하거나 클릭해서 선택</p>
          <p className="text-sm text-muted-foreground">.xlsx, .xls 파일 지원 · 최대 200행</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* 파일 선택됨 */}
      {file && !result && (
        <div className="space-y-4">
          {/* 파일 정보 */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border border-border">
            <FileSpreadsheet className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{preview.length}개 행 감지됨</p>
            </div>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 미리보기 테이블 */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                미리보기 (상위 {Math.min(preview.length, 5)}행 / 전체 {preview.length}행)
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border text-muted-foreground">
                      {HEADERS.map(h => (
                        <th key={h} className="text-left py-2 px-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        {HEADERS.map(h => (
                          <td key={h} className="py-2 px-3 max-w-[160px] truncate" title={row[h]}>
                            {row[h] || <span className="text-muted-foreground/40">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 설정 */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-medium">중복 건물 처리</p>
            <div className="flex gap-3">
              {([
                { val: "skip",   label: "건너뛰기",  desc: "기존 건물 유지" },
                { val: "update", label: "덮어쓰기",  desc: "이름·비밀번호·메모 갱신" },
              ] as const).map(opt => (
                <label
                  key={opt.val}
                  className={`flex-1 flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    duplicateAction === opt.val
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="dup"
                    value={opt.val}
                    checked={duplicateAction === opt.val}
                    onChange={() => setDuplicateAction(opt.val)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 등록 버튼 */}
          <button
            onClick={handleImport}
            disabled={loading || preview.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {`등록 중... (주소 변환 포함, 잠시 기다려주세요)`}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {`${preview.length}개 건물 등록 시작`}
              </>
            )}
          </button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "전체",    value: result.total,   color: "text-foreground",  bg: "bg-secondary" },
              { label: "성공",    value: result.success, color: "text-green-400",   bg: "bg-green-500/10" },
              { label: "건너뜀",  value: result.skipped, color: "text-yellow-400",  bg: "bg-yellow-500/10" },
              { label: "실패",    value: result.failed,  color: "text-red-400",     bg: "bg-red-500/10" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border border-border/50`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* 성공 메시지 */}
          {result.failed === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              모든 건물이 성공적으로 등록되었습니다!
            </div>
          )}

          {/* 에러 상세 */}
          {result.errors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  실패 상세 ({result.errors.length}건)
                </p>
                <button
                  onClick={() => downloadErrorLog(result.errors)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  오류 로그 다운로드
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium w-14">행</th>
                      <th className="text-left py-2 px-3 font-medium">주소</th>
                      <th className="text-left py-2 px-3 font-medium">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 px-3 text-muted-foreground">{e.row}</td>
                        <td className="py-2 px-3 max-w-[200px] truncate" title={e.address}>{e.address}</td>
                        <td className="py-2 px-3 text-red-400">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 건너뜀 안내 */}
          {result.skipped > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <SkipForward className="h-4 w-4 flex-shrink-0" />
              {result.skipped}개 건물은 이미 존재하여 건너뛰었습니다.
            </div>
          )}

          {/* 다시 등록 버튼 */}
          <button
            onClick={reset}
            className="w-full py-3 rounded-xl border border-border hover:bg-secondary/50 text-sm font-medium transition-colors"
          >
            새 파일 등록
          </button>
        </div>
      )}
    </div>
  )
}
