"use client"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { CurrentUser } from "@/types/building"

// approved_users.id 타입 (int8이지만 JS에서는 number로 취급)
type ApprovedUserId = number

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  receipt_date: string
  amount: number
  vendor_name: string | null
  category: string
  is_deductible: boolean
  receipt_image_url: string | null
}

interface Income {
  id: string
  income_date: string
  delivery_fee: number
  pickup_fee: number
  incentive: number
  vat_amount: number
  total_amount: number
  receipt_image_url: string | null
}

interface ManualExpenseForm {
  receipt_date: string
  vendor_name: string
  amount: string
  category: string
  is_deductible: "true" | "false"
  memo: string
}

interface ManualIncomeForm {
  income_date: string      // YYYY-MM (month input)
  delivery_fee: string
  pickup_fee: string
  incentive: string
  vat_amount: string
}

interface TaxTabProps {
  currentUser: CurrentUser | null
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  유류비: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  수리비: "bg-red-500/20 text-red-300 border-red-500/30",
  식비:   "bg-green-500/20 text-green-300 border-green-500/30",
  통신비: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  기타:   "bg-white/10 text-white/50 border-white/10",
}
const CATEGORIES = ["유류비", "수리비", "식비", "통신비", "기타"]

const THIS_YEAR = new Date().getFullYear()
const YEARS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2]
const MONTHS = [
  { value: "", label: "전체" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
]

const todayStr = () => new Date().toISOString().split("T")[0]
const thisMonthStr = () => new Date().toISOString().slice(0, 7) // YYYY-MM

const EMPTY_EXPENSE_FORM: ManualExpenseForm = {
  receipt_date: todayStr(),
  vendor_name: "",
  amount: "",
  category: "기타",
  is_deductible: "false",
  memo: "",
}
const EMPTY_INCOME_FORM: ManualIncomeForm = {
  income_date: thisMonthStr(),
  delivery_fee: "",
  pickup_fee: "",
  incentive: "",
  vat_amount: "",
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function TaxTab({ currentUser }: TaxTabProps) {
  // approved_users.id — expenses/income의 user_id 외래키 (카카오 ID와 다름)
  const [approvedUserId, setApprovedUserId] = useState<ApprovedUserId | null>(null)

  // 지출 상태
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [monthlyExpense, setMonthlyExpense] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [analyzingExpenseId, setAnalyzingExpenseId] = useState<string | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState<ManualExpenseForm>(EMPTY_EXPENSE_FORM)
  const [savingExpense, setSavingExpense] = useState(false)
  const expenseFileRef = useRef<HTMLInputElement>(null)

  // 수입 상태
  const [incomes, setIncomes] = useState<Income[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [uploadingIncome, setUploadingIncome] = useState(false)
  const [analyzingIncomeId, setAnalyzingIncomeId] = useState<string | null>(null)
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)
  const [incomeForm, setIncomeForm] = useState<ManualIncomeForm>(EMPTY_INCOME_FORM)
  const [savingIncome, setSavingIncome] = useState(false)
  const incomeFileRef = useRef<HTMLInputElement>(null)

  // 공통 상태
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR)
  const [selectedMonth, setSelectedMonth] = useState("")

  // ─── approved_users.id 조회 ──────────────────────────────────────────────
  // expenses/income 테이블의 user_id는 approved_users.id(소형 정수)를 외래키로 사용.
  // currentUser.userId는 카카오 ID(매우 큰 숫자)라 직접 사용하면 bigint 범위 초과 오류 발생.

  useEffect(() => {
    if (!currentUser?.email) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("approved_users")
        .select("id")
        .eq("email", currentUser.email)
        .maybeSingle()
      if (cancelled) return
      if (data?.id) {
        setApprovedUserId(data.id as ApprovedUserId)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser?.email])

  // ─── 데이터 조회 ─────────────────────────────────────────────────────────

  const fetchData = async (uid: ApprovedUserId) => {
    setLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

      // 이번 달 지출 합계 (approved_users.id 기준)
      const { data: expMonthData } = await supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", uid)
        .gte("receipt_date", startOfMonth)
        .lte("receipt_date", endOfMonth)
      setMonthlyExpense((expMonthData ?? []).reduce((s, e) => s + (e.amount ?? 0), 0))

      // 최근 지출 10개
      const { data: expRecentData } = await supabase
        .from("expenses")
        .select("id, receipt_date, amount, vendor_name, category, is_deductible, receipt_image_url")
        .eq("user_id", uid)
        .order("receipt_date", { ascending: false })
        .limit(10)
      setExpenses(expRecentData ?? [])

      // 이번 달 수입 합계
      const { data: incMonthData } = await supabase
        .from("income")
        .select("total_amount")
        .eq("user_id", uid)
        .gte("income_date", startOfMonth)
        .lte("income_date", endOfMonth)
      setMonthlyIncome((incMonthData ?? []).reduce((s, e) => s + (e.total_amount ?? 0), 0))

      // 최근 수입 6개
      const { data: incRecentData } = await supabase
        .from("income")
        .select("id, income_date, delivery_fee, pickup_fee, incentive, vat_amount, total_amount, receipt_image_url")
        .eq("user_id", uid)
        .order("income_date", { ascending: false })
        .limit(6)
      setIncomes(incRecentData ?? [])
    } catch (err) {
      console.error("데이터 조회 오류:", err)
    } finally {
      setLoading(false)
    }
  }

  // approvedUserId가 확정된 후에만 데이터 조회
  useEffect(() => {
    if (!approvedUserId) return
    void fetchData(approvedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedUserId])

  // ─── 영수증 OCR (지출) ──────────────────────────────────────────────────

  const handleExpenseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !approvedUserId) return
    setUploading(true)
    try {
      // Storage 경로는 카카오 ID 기반 유지 (단순 폴더명, 타입 제약 없음)
      const ext = file.name.split(".").pop() ?? "jpg"
      const filename = `${currentUser.userId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("receipts").upload(filename, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(filename)

      // INSERT 시 approved_users.id를 user_id로 사용 (카카오 ID 아님)
      const { data: inserted, error: insertError } = await supabase
        .from("expenses")
        .insert({
          user_id: approvedUserId,
          receipt_image_url: urlData.publicUrl,
          amount: 0,
          category: "기타",
          is_deductible: false,
          receipt_date: todayStr(),
        })
        .select("id")
        .single()
      if (insertError) throw insertError

      setUploading(false)
      await fetchData(approvedUserId)

      const expenseId = inserted.id as string
      setAnalyzingExpenseId(expenseId)

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: urlData.publicUrl, expenseId, type: "expense" }),
      })
      const ocrJson = (await ocrRes.json()) as { success?: boolean; data?: { amount: number; vendor_name: string } }
      if (ocrJson.success && ocrJson.data) {
        toast.success(`✅ 분석 완료! 금액: ${(ocrJson.data.amount ?? 0).toLocaleString()}원, 업체: ${ocrJson.data.vendor_name ?? "미확인"}`)
      } else {
        toast.warning("금액을 직접 입력해주세요.")
      }
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("영수증 업로드 오류:", err)
      toast.error("업로드에 실패했습니다.")
    } finally {
      setUploading(false)
      setAnalyzingExpenseId(null)
      e.target.value = ""
    }
  }

  // ─── 명세표 OCR (수입) ──────────────────────────────────────────────────

  const handleIncomeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !approvedUserId) return
    setUploadingIncome(true)
    try {
      // approved_users.id를 업로드 API에 전달 (income.user_id 외래키로 사용)
      const fd = new FormData()
      fd.append("file", file)
      fd.append("userId", String(approvedUserId))
      fd.append("storagePrefix", currentUser.userId) // Storage 폴더는 카카오 ID 유지

      const uploadRes = await fetch("/api/income/upload", { method: "POST", body: fd })
      if (!uploadRes.ok) throw new Error("업로드 실패")
      const { incomeId, imageUrl } = (await uploadRes.json()) as { incomeId: string; imageUrl: string }

      setUploadingIncome(false)
      await fetchData(approvedUserId)

      setAnalyzingIncomeId(incomeId)

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, incomeId, type: "income" }),
      })
      const ocrJson = (await ocrRes.json()) as { success?: boolean; data?: { total_amount: number } }
      if (ocrJson.success && ocrJson.data) {
        toast.success(`✅ 분석 완료! 합계: ${(ocrJson.data.total_amount ?? 0).toLocaleString()}원`)
      } else {
        toast.warning("내용을 직접 입력해주세요.")
      }
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("명세표 업로드 오류:", err)
      toast.error("업로드에 실패했습니다.")
    } finally {
      setUploadingIncome(false)
      setAnalyzingIncomeId(null)
      e.target.value = ""
    }
  }

  // ─── 직접 입력 저장 (지출) ──────────────────────────────────────────────

  const handleExpenseSave = async () => {
    if (!approvedUserId) return
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.warning("금액을 올바르게 입력해주세요.")
      return
    }
    setSavingExpense(true)
    try {
      // approved_users.id를 user_id로 사용 (카카오 ID 아님)
      const { error } = await supabase.from("expenses").insert({
        user_id: approvedUserId,
        receipt_date: expenseForm.receipt_date,
        vendor_name: expenseForm.vendor_name.trim() || null,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        is_deductible: expenseForm.is_deductible === "true",
        memo: expenseForm.memo.trim() || null,
        receipt_image_url: null,
      })
      if (error) throw error
      toast.success("✅ 저장되었습니다!")
      setExpenseModalOpen(false)
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("지출 저장 오류:", err)
      toast.error("저장에 실패했습니다.")
    } finally {
      setSavingExpense(false)
    }
  }

  // ─── 직접 입력 저장 (수입) ──────────────────────────────────────────────

  const handleIncomeSave = async () => {
    if (!approvedUserId) return
    const delivery  = Number(incomeForm.delivery_fee) || 0
    const pickup    = Number(incomeForm.pickup_fee)   || 0
    const incentive = Number(incomeForm.incentive)    || 0
    const vat       = Number(incomeForm.vat_amount)   || 0
    const total     = delivery + pickup + incentive + vat

    if (delivery <= 0) {
      toast.warning("배송수수료를 입력해주세요.")
      return
    }
    setSavingIncome(true)
    try {
      // income_date: YYYY-MM → YYYY-MM-01
      const incomeDate = incomeForm.income_date
        ? `${incomeForm.income_date}-01`
        : new Date().toISOString().slice(0, 7) + "-01"

      // approved_users.id를 user_id로 사용 (카카오 ID 아님)
      const { error } = await supabase.from("income").insert({
        user_id: approvedUserId,
        income_date: incomeDate,
        delivery_fee: delivery,
        pickup_fee: pickup,
        incentive,
        vat_amount: vat,
        total_amount: total,
        receipt_image_url: null,
      })
      if (error) throw error
      toast.success("✅ 저장되었습니다!")
      setIncomeModalOpen(false)
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("수입 저장 오류:", err)
      toast.error("저장에 실패했습니다.")
    } finally {
      setSavingIncome(false)
    }
  }

  // ─── 엑셀 다운로드 ──────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!approvedUserId) return
    setDownloading(true)
    try {
      // 엑셀 API에도 approved_users.id 전달
      const params = new URLSearchParams({ user_id: String(approvedUserId), year: String(selectedYear) })
      if (selectedMonth) params.set("month", selectedMonth)
      const res = await fetch(`/api/expenses/download?${params.toString()}`)
      if (res.status === 404) { toast.warning("다운로드할 지출 내역이 없습니다."); return }
      if (!res.ok) throw new Error("다운로드 실패")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const monthSuffix = selectedMonth ? `_${selectedMonth}월` : ""
      a.href = url
      a.download = `지출내역_${selectedYear}년${monthSuffix}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("엑셀 다운로드 오류:", err)
      toast.error("다운로드에 실패했습니다.")
    } finally {
      setDownloading(false)
    }
  }

  // ─── 파생 값 ─────────────────────────────────────────────────────────────

  const netProfit = monthlyIncome - monthlyExpense
  const isAnalyzingExpense = analyzingExpenseId !== null
  const isAnalyzingIncome  = analyzingIncomeId !== null

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <section className="container mx-auto px-4 py-4 space-y-4">

      {/* ── 상단 요약 카드 3개 ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
          <p className="text-[11px] text-white/40">이번 달 수입</p>
          <p className="text-xl font-bold text-emerald-400">
            {loading ? "..." : `${monthlyIncome.toLocaleString()}원`}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
          <p className="text-[11px] text-white/40">이번 달 지출</p>
          <p className="text-xl font-bold text-white">
            {loading ? "..." : `${monthlyExpense.toLocaleString()}원`}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
          <p className="text-[11px] text-white/40">순이익</p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-blue-400" : "text-red-400"}`}>
            {loading ? "..." : `${netProfit.toLocaleString()}원`}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          수입 섹션
      ══════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
          <span>💰</span> 이번 달 수입
        </h2>

        {/* 명세표 업로드 + 직접 입력 */}
        <div className="flex gap-2">
          <button
            onClick={() => incomeFileRef.current?.click()}
            disabled={uploadingIncome || isAnalyzingIncome || !currentUser || !approvedUserId}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
          >
            {uploadingIncome ? (
              <><span>⏳</span>업로드 중...</>
            ) : isAnalyzingIncome ? (
              <><span>🔍</span>분석 중...</>
            ) : (
              <><span>📸</span>명세표 업로드</>
            )}
          </button>
          <button
            onClick={() => { setIncomeForm({ ...EMPTY_INCOME_FORM, income_date: thisMonthStr() }); setIncomeModalOpen(true) }}
            disabled={!currentUser || !approvedUserId}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-4 text-sm font-semibold text-white/80 transition-all duration-200"
          >
            <span>✏️</span>
            <span className="whitespace-nowrap">직접 입력</span>
          </button>
        </div>
        <input ref={incomeFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleIncomeFileChange} />

        {/* 수입 목록 */}
        {loading ? (
          <div className="text-center py-6 text-white/30 text-sm">불러오는 중...</div>
        ) : incomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 border border-dashed border-white/10 py-8 gap-2">
            <span className="text-2xl opacity-40">📋</span>
            <p className="text-sm text-white/30">정산명세표를 등록해보세요!</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {incomes.map((inc) => (
              <li
                key={inc.id}
                className={`rounded-xl border px-4 py-3 transition-colors ${
                  inc.id === analyzingIncomeId
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {inc.id === analyzingIncomeId ? (
                  <p className="text-emerald-300 text-xs">🔍 분석 중...</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">{inc.income_date.slice(0, 7)}</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {(inc.total_amount ?? 0).toLocaleString()}원
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/40">
                      <span>배송 {(inc.delivery_fee ?? 0).toLocaleString()}</span>
                      {(inc.pickup_fee ?? 0) > 0 && <span>집하 {inc.pickup_fee.toLocaleString()}</span>}
                      {(inc.incentive ?? 0) > 0 && <span>인센티브 {inc.incentive.toLocaleString()}</span>}
                      {(inc.vat_amount ?? 0) > 0 && <span>부가세 {inc.vat_amount.toLocaleString()}</span>}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          지출 섹션 (기존 유지)
      ══════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
          <span>🧾</span> 지출 관리
        </h2>

        {/* 회계자료 다운로드 */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-sm font-medium text-white/70">회계자료 다운로드</p>
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="flex-1 rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              {YEARS.map((y) => (
                <option key={y} value={y} className="bg-slate-900">{y}년</option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void handleDownload()}
            disabled={downloading || !currentUser || !approvedUserId}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-emerald-300 transition-all duration-200"
          >
            {downloading ? <><span>⏳</span>다운로드 중...</> : <><span>📥</span>회계자료 다운로드 (엑셀)</>}
          </button>
        </div>

        {/* 영수증 업로드 + 직접 입력 */}
        <div className="flex gap-2">
          <button
            onClick={() => expenseFileRef.current?.click()}
            disabled={uploading || isAnalyzingExpense || !currentUser || !approvedUserId}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200"
          >
            {uploading ? (
              <><span className="text-xl">⏳</span>업로드 중...</>
            ) : isAnalyzingExpense ? (
              <><span className="text-xl">🔍</span>분석 중...</>
            ) : (
              <><span className="text-xl">📸</span>영수증 업로드</>
            )}
          </button>
          <button
            onClick={() => { setExpenseForm({ ...EMPTY_EXPENSE_FORM, receipt_date: todayStr() }); setExpenseModalOpen(true) }}
            disabled={!currentUser || !approvedUserId}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-5 text-sm font-semibold text-white/80 transition-all duration-200"
          >
            <span className="text-base">✏️</span>
            <span className="whitespace-nowrap">직접 입력</span>
          </button>
        </div>
        <input ref={expenseFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleExpenseFileChange} />

        {/* 지출 목록 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/60">최근 지출</h3>
          {loading ? (
            <div className="text-center py-8 text-white/30 text-sm">불러오는 중...</div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 border border-dashed border-white/10 py-12 gap-2">
              <span className="text-3xl opacity-40">🧾</span>
              <p className="text-sm text-white/30">영수증을 등록해보세요!</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    expense.id === analyzingExpenseId
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {expense.id === analyzingExpenseId ? (
                          <span className="text-blue-300 text-xs">🔍 분석 중...</span>
                        ) : (
                          expense.vendor_name ?? "업체명 없음"
                        )}
                      </span>
                      <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS["기타"]}`}>
                        {expense.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">{expense.receipt_date}</p>
                  </div>
                  <span className="text-sm font-bold text-white shrink-0">
                    {(expense.amount ?? 0).toLocaleString()}원
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          지출 직접 입력 모달
      ══════════════════════════════════════════════ */}
      {expenseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!savingExpense) setExpenseModalOpen(false) }}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl px-5 py-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">지출 직접 입력</h2>
              <button onClick={() => { if (!savingExpense) setExpenseModalOpen(false) }} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50">날짜</label>
              <input type="date" value={expenseForm.receipt_date} onChange={(e) => setExpenseForm((f) => ({ ...f, receipt_date: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">업체명</label>
              <input type="text" value={expenseForm.vendor_name} onChange={(e) => setExpenseForm((f) => ({ ...f, vendor_name: e.target.value }))}
                placeholder="예: 하이패스"
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">금액 <span className="text-red-400">*</span></label>
              <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="숫자만 입력" min={0}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">카테고리</label>
              <select value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-blue-500/50">
                {CATEGORIES.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">부가세공제</label>
              <div className="flex gap-3">
                {(["true", "false"] as const).map((val) => (
                  <label key={val} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium cursor-pointer transition-colors ${
                    expenseForm.is_deductible === val ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-white/5 border-white/10 text-white/50"}`}>
                    <input type="radio" name="is_deductible" value={val} checked={expenseForm.is_deductible === val}
                      onChange={() => setExpenseForm((f) => ({ ...f, is_deductible: val }))} className="hidden" />
                    {val === "true" ? "가능" : "불가"}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">메모 <span className="text-white/30">(선택)</span></label>
              <input type="text" value={expenseForm.memo} onChange={(e) => setExpenseForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="간단한 메모"
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-blue-500/50" />
            </div>
            <button onClick={() => void handleExpenseSave()} disabled={savingExpense}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200">
              {savingExpense ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          수입 직접 입력 모달
      ══════════════════════════════════════════════ */}
      {incomeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!savingIncome) setIncomeModalOpen(false) }}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl px-5 py-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">수입 직접 입력</h2>
              <button onClick={() => { if (!savingIncome) setIncomeModalOpen(false) }} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50">정산월</label>
              <input type="month" value={incomeForm.income_date} onChange={(e) => setIncomeForm((f) => ({ ...f, income_date: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">배송수수료 <span className="text-red-400">*</span></label>
              <input type="number" value={incomeForm.delivery_fee} onChange={(e) => setIncomeForm((f) => ({ ...f, delivery_fee: e.target.value }))}
                placeholder="숫자만 입력" min={0}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">집하수수료 <span className="text-white/30">(선택)</span></label>
              <input type="number" value={incomeForm.pickup_fee} onChange={(e) => setIncomeForm((f) => ({ ...f, pickup_fee: e.target.value }))}
                placeholder="숫자만 입력" min={0}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">인센티브 <span className="text-white/30">(선택)</span></label>
              <input type="number" value={incomeForm.incentive} onChange={(e) => setIncomeForm((f) => ({ ...f, incentive: e.target.value }))}
                placeholder="숫자만 입력" min={0}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">부가세액 <span className="text-white/30">(선택)</span></label>
              <input type="number" value={incomeForm.vat_amount} onChange={(e) => setIncomeForm((f) => ({ ...f, vat_amount: e.target.value }))}
                placeholder="숫자만 입력" min={0}
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-emerald-500/50" />
            </div>

            {/* 합계 자동 계산 표시 */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-white/60">합계 (자동)</span>
              <span className="text-base font-bold text-emerald-400">
                {(
                  (Number(incomeForm.delivery_fee) || 0) +
                  (Number(incomeForm.pickup_fee)   || 0) +
                  (Number(incomeForm.incentive)    || 0) +
                  (Number(incomeForm.vat_amount)   || 0)
                ).toLocaleString()}원
              </span>
            </div>

            <button onClick={() => void handleIncomeSave()} disabled={savingIncome}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200">
              {savingIncome ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
