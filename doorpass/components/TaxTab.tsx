"use client"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { CurrentUser } from "@/types/building"

// expenses 테이블 행 타입
interface Expense {
  id: string
  receipt_date: string
  amount: number
  vendor_name: string | null
  category: string
  is_deductible: boolean
  receipt_image_url: string | null
}

interface TaxTabProps {
  currentUser: CurrentUser | null
}

// 카테고리별 뱃지 색상
const CATEGORY_COLORS: Record<string, string> = {
  유류비: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  수리비: "bg-red-500/20 text-red-300 border-red-500/30",
  식비:   "bg-green-500/20 text-green-300 border-green-500/30",
  통신비: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  기타:   "bg-white/10 text-white/50 border-white/10",
}

export function TaxTab({ currentUser }: TaxTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [deductibleAmount, setDeductibleAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 이번 달 지출 합계 + 최근 10개 목록 조회
  const fetchData = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split("T")[0]
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split("T")[0]

      // 이번 달 전체/공제가능 합계
      const { data: monthData, error: monthError } = await supabase
        .from("expenses")
        .select("amount, is_deductible")
        .eq("user_id", currentUser.userId)
        .gte("receipt_date", startOfMonth)
        .lte("receipt_date", endOfMonth)

      if (monthError) throw monthError

      const total = (monthData ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0)
      const deductible = (monthData ?? [])
        .filter((e) => e.is_deductible)
        .reduce((sum, e) => sum + (e.amount ?? 0), 0)
      setTotalAmount(total)
      setDeductibleAmount(deductible)

      // 최근 지출 목록 (최신 10개)
      const { data: recentData, error: recentError } = await supabase
        .from("expenses")
        .select("id, receipt_date, amount, vendor_name, category, is_deductible, receipt_image_url")
        .eq("user_id", currentUser.userId)
        .order("receipt_date", { ascending: false })
        .limit(10)

      if (recentError) throw recentError
      setExpenses(recentData ?? [])
    } catch (err) {
      console.error("지출 조회 오류:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // 영수증 이미지 선택 → Storage 업로드 → expenses INSERT
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    setUploading(true)
    try {
      // 1) Supabase Storage "receipts" 버킷에 업로드
      const ext = file.name.split(".").pop() ?? "jpg"
      const filename = `${currentUser.userId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filename, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(filename)

      // 2) expenses 테이블에 신규 행 추가
      const today = new Date().toISOString().split("T")[0]
      const { error: insertError } = await supabase.from("expenses").insert({
        user_id: currentUser.userId,
        receipt_image_url: urlData.publicUrl,
        amount: 0,
        category: "기타",
        is_deductible: false,
        receipt_date: today,
      })

      if (insertError) throw insertError

      toast.success("저장되었습니다!")
      await fetchData() // 목록 새로고침
    } catch (err) {
      console.error("영수증 업로드 오류:", err)
      toast.error("업로드에 실패했습니다.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <section className="container mx-auto px-4 py-4 space-y-4">

      {/* 상단 요약 카드 2개 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-xs text-white/40">이번 달 지출</p>
          <p className="text-2xl font-bold text-white">
            {loading ? "..." : `${totalAmount.toLocaleString()}원`}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
          <p className="text-xs text-white/40">공제 가능 금액</p>
          <p className="text-2xl font-bold text-emerald-400">
            {loading ? "..." : `${deductibleAmount.toLocaleString()}원`}
          </p>
        </div>
      </div>

      {/* 영수증 촬영/업로드 버튼 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || !currentUser}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200"
      >
        {uploading ? (
          <><span className="text-xl">⏳</span>업로드 중...</>
        ) : (
          <><span className="text-xl">📸</span>영수증 촬영/업로드</>
        )}
      </button>
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 최근 지출 목록 */}
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
                className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {expense.vendor_name ?? "업체명 없음"}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${
                        CATEGORY_COLORS[expense.category] ?? CATEGORY_COLORS["기타"]
                      }`}
                    >
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
    </section>
  )
}
