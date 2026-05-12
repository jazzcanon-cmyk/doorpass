"use client"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { CurrentUser } from "@/types/building"
import { isKakaoShareReady, shareExpensePdf } from "@/lib/kakao-share"

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
  is_expense: boolean | null       // 경비처리 가능 여부 (DEFAULT true)
  deduction_reason: string | null  // OCR 판단 이유
  receipt_image_url: string | null
  business_number: string | null   // OCR 추출 사업자번호
  vendor_tax_type: string | null   // 국세청 확인 과세유형 (null이면 AI 판단만)
}

interface Income {
  id: string
  income_date: string
  delivery_fee: number
  pickup_fee: number
  incentive: number
  vat_amount: number
  total_amount: number
  statement_image_url: string | null  // income 테이블 실제 컬럼명
}

interface BusinessInfo {
  id: string
  business_number: string | null
  business_name: string | null
  owner_name: string | null
  open_date: string | null
  business_type: string | null
  business_item: string | null
  tax_type: string | null
  registration_image_url: string | null
  is_verified: boolean
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

// 카드명세서에서 추출된 개별 거래
interface StatementTransaction {
  receipt_date: string
  amount: number
  vendor_name: string
  category: string
  is_deductible: boolean
  is_expense: boolean
  deduction_reason: string
}

// 카드명세서 분석 결과 (3단계 분류)
interface StatementResult {
  total: number
  confirmed: StatementTransaction[]  // 확실한 중복 (자동 제외)
  suspected: StatementTransaction[]  // 의심 중복 (사용자 확인 필요)
  newItems:  StatementTransaction[]  // 신규 항목
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
// 회계자료 다운로드 기간 옵션 (전체 / 분기 / 반기 / 개별 월)
const PERIODS = [
  { value: "all", label: "전체" },
  { value: "q1",  label: "1분기 (1~3월)" },
  { value: "q2",  label: "2분기 (4~6월)" },
  { value: "q3",  label: "3분기 (7~9월)" },
  { value: "q4",  label: "4분기 (10~12월)" },
  { value: "h1",  label: "상반기 (1~6월)" },
  { value: "h2",  label: "하반기 (7~12월)" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
]

// period 값 → 파일명 라벨 매핑
const PERIOD_LABELS: Record<string, string> = {
  all: "전체", q1: "1분기", q2: "2분기", q3: "3분기", q4: "4분기",
  h1: "상반기", h2: "하반기",
}

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

// ─── SHA-256 해시 헬퍼 (중복 영수증 감지용) ──────────────────────────────────
// 브라우저 내장 crypto.subtle 사용 — 서버 fetch 없이 클라이언트에서 계산
async function computeImageHash(file: File): Promise<string> {
  const buf      = await file.arrayBuffer()
  const hashBuf  = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// ─── Storage 경로 정규화 ──────────────────────────────────────────────────────
// 공개 URL이면 receipts 버킷 이하 경로만 추출, 이미 경로면 그대로 반환
function toStoragePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) return urlOrPath
  const marker = "/object/public/receipts/"
  const idx = urlOrPath.indexOf(marker)
  return idx === -1 ? urlOrPath : urlOrPath.slice(idx + marker.length)
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
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)  // 삭제 중인 지출 항목 id
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState<ManualExpenseForm>(EMPTY_EXPENSE_FORM)
  const [savingExpense, setSavingExpense] = useState(false)
  const expenseFileRef   = useRef<HTMLInputElement>(null)
  const statementFileRef = useRef<HTMLInputElement>(null)  // 카드명세서 전용

  // 사업자 상태
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [uploadingBusiness, setUploadingBusiness] = useState(false)
  const [analyzingBusiness, setAnalyzingBusiness] = useState(false)
  const [savingTaxType, setSavingTaxType] = useState(false)
  const businessFileRef = useRef<HTMLInputElement>(null)

  // 수입 상태
  const [incomes, setIncomes] = useState<Income[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [uploadingIncome, setUploadingIncome] = useState(false)
  const [analyzingIncomeId, setAnalyzingIncomeId] = useState<string | null>(null)
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null)    // 삭제 중인 수입 항목 id
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)
  const [incomeForm, setIncomeForm] = useState<ManualIncomeForm>(EMPTY_INCOME_FORM)
  const [savingIncome, setSavingIncome] = useState(false)
  const incomeFileRef = useRef<HTMLInputElement>(null)

  // 공통 상태
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR)
  const [selectedPeriod, setSelectedPeriod] = useState("all") // 기간 옵션 (all/q1~q4/h1~h2/1~12)

  // 이메일 발송 모달 상태
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({ name: "", email: "" })
  const [sendingEmail, setSendingEmail] = useState(false)

  // 카카오 공유 상태
  const [sharingKakao, setSharingKakao] = useState(false)

  // 카드명세서 일괄 업로드 상태
  const [importingStatement, setImportingStatement]   = useState(false)
  const [statementModalOpen, setStatementModalOpen]   = useState(false)
  const [statementResult,    setStatementResult]      = useState<StatementResult | null>(null)
  const [insertingStatement, setInsertingStatement]   = useState(false)
  // 의심 중복 항목 중 사용자가 "그래도 추가"를 선택한 인덱스 집합
  const [suspectedIncluded, setSuspectedIncluded]     = useState<Set<number>>(new Set())

  // 비공개 버킷 — 영수증 서명 URL 캐시 { expenseId → signedUrl }
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  // 개인정보 보호 안내 팝업 (최초 진입 시 1회만)
  const [securityPopupOpen, setSecurityPopupOpen] = useState(false)

  // ─── 보안 안내 팝업 초기화 (마운트 후 localStorage 확인) ─────────────────────
  useEffect(() => {
    if (!localStorage.getItem("taxpass_security_agreed")) {
      setSecurityPopupOpen(true)
    }
  }, [])

  const handleSecurityAgree = () => {
    localStorage.setItem("taxpass_security_agreed", "1")
    setSecurityPopupOpen(false)
  }

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

  // ─── 사업자 정보 조회 ────────────────────────────────────────────────────

  const fetchBusinessInfo = async (uid: ApprovedUserId) => {
    const { data } = await supabase
      .from("business_info")
      .select("id, business_number, business_name, owner_name, open_date, business_type, business_item, tax_type, registration_image_url, is_verified")
      .eq("user_id", uid)
      .maybeSingle()
    setBusinessInfo(data ?? null)
  }

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
        .select("id, receipt_date, amount, vendor_name, category, is_deductible, is_expense, deduction_reason, receipt_image_url, business_number, vendor_tax_type")
        .eq("user_id", uid)
        .order("receipt_date", { ascending: false })
        .limit(10)
      setExpenses(expRecentData ?? [])

      // 비공개 버킷 — 영수증 이미지용 서명 URL 일괄 생성 (1시간 유효)
      const imgItems = (expRecentData ?? []).filter((e) => e.receipt_image_url)
      if (imgItems.length > 0) {
        const paths = imgItems.map((e) => toStoragePath(e.receipt_image_url!))
        const { data: signedData } = await supabase.storage
          .from("receipts")
          .createSignedUrls(paths, 3600)
        if (signedData) {
          const map: Record<string, string> = {}
          signedData.forEach((s, i) => { if (s.signedUrl) map[imgItems[i].id] = s.signedUrl })
          setSignedUrls(map)
        }
      }

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
        .select("id, income_date, delivery_fee, pickup_fee, incentive, vat_amount, total_amount, statement_image_url")
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

  // approvedUserId가 확정된 후 데이터 조회 (사업자 정보 + 수입/지출)
  useEffect(() => {
    if (!approvedUserId) return
    void fetchBusinessInfo(approvedUserId)
    void fetchData(approvedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedUserId])

  // ─── 사업자등록증 업로드 + OCR ──────────────────────────────────────────

  const handleBusinessFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !approvedUserId) return
    setUploadingBusiness(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("userId", String(approvedUserId))

      const uploadRes = await fetch("/api/business/upload", { method: "POST", body: fd })
      if (!uploadRes.ok) throw new Error("업로드 실패")
      const { businessId, imageUrl } = (await uploadRes.json()) as { businessId: string; imageUrl: string }

      // 업로드 완료 후 즉시 화면 갱신
      await fetchBusinessInfo(approvedUserId)
      setAnalyzingBusiness(true)

      // OCR 분석 (uploadingBusiness는 finally에서 해제 — 중복 업로드 방지)
      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, businessId, type: "business" }),
      })
      const ocrJson = (await ocrRes.json()) as { success?: boolean; data?: { business_name: string } }
      if (ocrJson.success && ocrJson.data) {
        toast.success(`✅ 사업자 정보가 등록됐습니다! 상호: ${ocrJson.data.business_name ?? ""}`)
      } else {
        toast.warning("사업자 정보를 확인해주세요.")
      }
      await fetchBusinessInfo(approvedUserId)
    } catch (err) {
      console.error("사업자등록증 업로드 오류:", err)
      toast.error("업로드에 실패했습니다.")
    } finally {
      setUploadingBusiness(false)
      setAnalyzingBusiness(false)
      e.target.value = ""
    }
  }

  // ─── 과세유형 수동 변경 ──────────────────────────────────────────────────

  const handleTaxTypeChange = async (taxType: string) => {
    if (!approvedUserId || !businessInfo) return
    setSavingTaxType(true)
    try {
      const { error } = await supabase
        .from("business_info")
        .update({ tax_type: taxType })
        .eq("user_id", approvedUserId)
      if (error) throw error
      // 로컬 상태만 업데이트해 리패치 없이 즉시 반영
      setBusinessInfo((prev) => prev ? { ...prev, tax_type: taxType } : prev)
      toast.success("과세유형이 변경됐습니다.")
    } catch (err) {
      console.error("과세유형 변경 오류:", err)
      toast.error("변경에 실패했습니다.")
    } finally {
      setSavingTaxType(false)
    }
  }

  // ─── 영수증 OCR (지출) ──────────────────────────────────────────────────

  const handleExpenseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !approvedUserId) return
    setUploading(true)
    try {
      // ① SHA-256 해시로 중복 영수증 사전 체크 (실패 시 업로드 계속 진행)
      let imageHash: string | null = null
      try {
        imageHash = await computeImageHash(file)
        const dupRes = await fetch("/api/expenses/check-duplicate", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ user_id: String(approvedUserId), image_hash: imageHash }),
        })
        if (dupRes.ok) {
          const dupJson = (await dupRes.json()) as {
            isDuplicate: boolean
            existing?: { vendor_name: string | null; receipt_date: string; amount: number }
          }
          if (dupJson.isDuplicate && dupJson.existing) {
            const { vendor_name, receipt_date, amount } = dupJson.existing
            toast.warning(
              `이미 등록된 영수증입니다\n업체: ${vendor_name ?? "미확인"} / 날짜: ${receipt_date} / 금액: ${amount.toLocaleString()}원`,
              { duration: 5000 }
            )
            return  // finally → setUploading(false) 실행됨
          }
        }
      } catch {
        console.warn("중복 확인 실패, 업로드 계속 진행")
      }

      // ② Storage 업로드 (카카오 ID 기반 경로 유지)
      const ext = file.name.split(".").pop() ?? "jpg"
      const filename = `${currentUser.userId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("receipts").upload(filename, file)
      if (uploadError) throw uploadError
      // 비공개 버킷 — 공개 URL 대신 Storage 경로만 DB에 저장

      // ③ INSERT — image_hash, import_source 포함 (approved_users.id 사용)
      const { data: inserted, error: insertError } = await supabase
        .from("expenses")
        .insert({
          user_id:           approvedUserId,
          receipt_image_url: filename,    // Storage 경로 저장 (공개 URL 아님)
          amount:            0,
          category:          "기타",
          is_deductible:     false,
          receipt_date:      todayStr(),
          image_hash:        imageHash,   // null if hash failed
          import_source:     "ocr",
        })
        .select("id")
        .single()
      if (insertError) throw insertError

      // uploading 상태는 OCR 완료 후 finally에서만 해제 (중복 클릭 방지)
      await fetchData(approvedUserId)

      const expenseId = inserted.id as string
      setAnalyzingExpenseId(expenseId)

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: filename, expenseId, type: "expense" }),
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

      // uploadingIncome 상태는 OCR 완료 후 finally에서만 해제 (중복 클릭 방지)
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
        statement_image_url: null,  // income 테이블 실제 컬럼명
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

  // ─── Storage 경로 추출 ────────────────────────────────────────────────────
  // Supabase 공개 URL에서 버킷 이하 경로만 추출 (storage.remove에 사용)
  function getStoragePath(urlOrPath: string): string | null {
    if (!urlOrPath.startsWith("http")) return urlOrPath  // 이미 Storage 경로
    const marker = "/object/public/receipts/"
    const idx = urlOrPath.indexOf(marker)
    return idx === -1 ? null : urlOrPath.slice(idx + marker.length)
  }

  // ─── 지출 삭제 ────────────────────────────────────────────────────────────
  const handleDeleteExpense = async (expense: Expense) => {
    const confirmed = window.confirm(
      `이 지출 항목을 삭제할까요?\n업체명: ${expense.vendor_name ?? "미확인"} / 금액: ${(expense.amount ?? 0).toLocaleString()}원`
    )
    if (!confirmed || !approvedUserId) return
    setDeletingExpenseId(expense.id)
    try {
      // 영수증 이미지 삭제 (Storage에 있는 경우)
      if (expense.receipt_image_url) {
        const storagePath = getStoragePath(expense.receipt_image_url)
        if (storagePath) await supabase.storage.from("receipts").remove([storagePath])
      }
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id)
      if (error) throw error
      toast.success("✅ 삭제됐습니다")
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("지출 삭제 오류:", err)
      toast.error("삭제에 실패했습니다.")
    } finally {
      setDeletingExpenseId(null)
    }
  }

  // ─── 수입 삭제 ────────────────────────────────────────────────────────────
  const handleDeleteIncome = async (inc: Income) => {
    const confirmed = window.confirm(
      `이 수입 항목을 삭제할까요?\n정산월: ${inc.income_date.slice(0, 7)} / 합계: ${(inc.total_amount ?? 0).toLocaleString()}원`
    )
    if (!confirmed || !approvedUserId) return
    setDeletingIncomeId(inc.id)
    try {
      // 명세표 이미지 삭제 (Storage에 있는 경우)
      if (inc.statement_image_url) {
        const storagePath = getStoragePath(inc.statement_image_url)
        if (storagePath) await supabase.storage.from("receipts").remove([storagePath])
      }
      const { error } = await supabase.from("income").delete().eq("id", inc.id)
      if (error) throw error
      toast.success("✅ 삭제됐습니다")
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("수입 삭제 오류:", err)
      toast.error("삭제에 실패했습니다.")
    } finally {
      setDeletingIncomeId(null)
    }
  }

  // ─── PDF 다운로드 ───────────────────────────────────────────────────────

  const handlePdfDownload = async () => {
    if (!approvedUserId) return
    setDownloadingPdf(true)
    try {
      const params = new URLSearchParams({
        user_id: String(approvedUserId),
        year:    String(selectedYear),
        period:  selectedPeriod,
      })
      const res = await fetch(`/api/expenses/pdf?${params.toString()}`)
      if (res.status === 404) { toast.warning("다운로드할 지출 내역이 없습니다."); return }
      if (!res.ok) throw new Error("PDF 생성 실패")
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      const periodLabel = PERIOD_LABELS[selectedPeriod] ?? `${selectedPeriod}월`
      a.href     = url
      a.download = `지출내역서_${selectedYear}년_${periodLabel}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF 다운로드 오류:", err)
      toast.error("PDF 생성에 실패했습니다.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ─── 이메일 발송 ─────────────────────────────────────────────────────────

  const handleEmailSend = async () => {
    if (!approvedUserId) return
    if (!emailForm.email) { toast.warning("이메일 주소를 입력해주세요."); return }
    setSendingEmail(true)
    try {
      const res = await fetch("/api/expenses/email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          user_id:         String(approvedUserId),
          year:            String(selectedYear),
          period:          selectedPeriod,
          recipient_email: emailForm.email,
          recipient_name:  emailForm.name || "고객",
        }),
      })
      if (res.status === 404) { toast.warning("발송할 지출 내역이 없습니다."); return }
      const json = (await res.json()) as { success?: boolean }
      if (json.success) {
        toast.success("✅ 이메일이 발송됐습니다!")
        setEmailModalOpen(false)
        setEmailForm({ name: "", email: "" })
      } else {
        toast.error("❌ 발송 실패. 이메일을 확인해주세요.")
      }
    } catch (err) {
      console.error("이메일 발송 오류:", err)
      toast.error("❌ 발송 실패. 이메일을 확인해주세요.")
    } finally {
      setSendingEmail(false)
    }
  }

  // ─── 카드명세서 분석 ─────────────────────────────────────────────────────

  const handleStatementFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !approvedUserId) return
    setImportingStatement(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("user_id", String(approvedUserId))

      const res = await fetch("/api/expenses/import-statement", { method: "POST", body: fd })
      const json = (await res.json()) as StatementResult & { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "명세서 분석에 실패했습니다.")
        return
      }
      // 분석 완료 → 의심 항목 선택 초기화 후 결과 모달 표시
      setSuspectedIncluded(new Set())
      setStatementResult(json)
      setStatementModalOpen(true)
    } catch (err) {
      console.error("카드명세서 업로드 오류:", err)
      toast.error("명세서 분석에 실패했습니다.")
    } finally {
      setImportingStatement(false)
      e.target.value = ""
    }
  }

  // ─── 카드명세서 항목 일괄 추가 (items 배열 직접 지정) ────────────────────

  const handleStatementInsert = async (items: StatementTransaction[]) => {
    if (!approvedUserId || !items.length) return
    setInsertingStatement(true)
    try {
      const res = await fetch("/api/expenses/bulk-insert", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: String(approvedUserId), items }),
      })
      const json = (await res.json()) as { inserted?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? "추가 실패")
      toast.success(`✅ ${json.inserted}건이 추가됐습니다!`)
      setStatementModalOpen(false)
      setStatementResult(null)
      setSuspectedIncluded(new Set())
      await fetchData(approvedUserId)
    } catch (err) {
      console.error("일괄 추가 오류:", err)
      toast.error("추가에 실패했습니다.")
    } finally {
      setInsertingStatement(false)
    }
  }

  // ─── 카카오톡 공유 ──────────────────────────────────────────────────────

  const handleKakaoShare = async () => {
    if (!approvedUserId) return
    // 카카오 SDK 초기화 여부 확인 (SDK 로드 전이거나 키 미설정 시)
    if (!isKakaoShareReady()) {
      toast.warning("카카오 앱 설정을 확인해주세요.")
      return
    }
    setSharingKakao(true)
    try {
      const params = new URLSearchParams({
        user_id: String(approvedUserId),
        year:    String(selectedYear),
        period:  selectedPeriod,
      })
      const res = await fetch(`/api/expenses/share?${params.toString()}`)
      if (res.status === 404) { toast.warning("공유할 지출 내역이 없습니다."); return }
      if (!res.ok) throw new Error("공유 링크 생성 실패")

      const json = (await res.json()) as {
        url: string
        shareId?: string
        periodLabel: string
        totalAmount: number
        deductibleAmount: number
        expiresAt?: string
      }

      // 카카오톡 공유창 열기 (모바일: 앱, PC: 팝업)
      const shared = shareExpensePdf({
        pdfUrl:           json.url,
        shareId:          json.shareId,
        year:             String(selectedYear),
        periodLabel:      json.periodLabel,
        totalAmount:      json.totalAmount,
        deductibleAmount: json.deductibleAmount,
        expiresAt:        json.expiresAt,
      })
      if (!shared) toast.warning("카카오 앱 설정을 확인해주세요.")
    } catch (err) {
      console.error("카카오 공유 오류:", err)
      toast.error("공유에 실패했습니다.")
    } finally {
      setSharingKakao(false)
    }
  }

  // ─── 엑셀 다운로드 ──────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!approvedUserId) return
    setDownloading(true)
    try {
      // period 파라미터로 분기/반기/개별 월 전달
      const params = new URLSearchParams({
        user_id: String(approvedUserId),
        year:    String(selectedYear),
        period:  selectedPeriod,
      })
      const res = await fetch(`/api/expenses/download?${params.toString()}`)
      if (res.status === 404) { toast.warning("다운로드할 지출 내역이 없습니다."); return }
      if (!res.ok) throw new Error("다운로드 실패")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      // 파일명 라벨: 분기/반기는 매핑 테이블, 숫자면 "N월"
      const periodLabel = PERIOD_LABELS[selectedPeriod] ?? `${selectedPeriod}월`
      a.href = url
      a.download = `지출내역_${selectedYear}년_${periodLabel}.xlsx`
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

      {/* ══════════════════════════════════════════════
          개인정보 보호 안내 팝업 (최초 진입 시 1회)
      ══════════════════════════════════════════════ */}
      {securityPopupOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl px-6 py-7 space-y-5 shadow-2xl">
            {/* 헤더 */}
            <div className="text-center space-y-1">
              <p className="text-2xl">🔒</p>
              <h2 className="text-base font-bold text-white">개인정보 보호 안내</h2>
            </div>

            {/* 보안 항목 */}
            <ul className="space-y-2.5">
              {[
                "AES-256 암호화 저장",
                "본인 외 열람 완전 차단",
                "HTTPS 암호화 전송",
                "만료되는 임시 URL 사용",
                "언제든지 삭제 가능",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                  <span className="text-green-400 text-base shrink-0">✅</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* 설명 */}
            <p className="text-xs text-white/50 text-center leading-relaxed">
              귀하의 사업자등록증, 영수증, 수입명세표는
              <br />
              철저하게 보호되며 본인만 열람할 수 있습니다.
            </p>

            {/* 확인 버튼 */}
            <button
              onClick={handleSecurityAgree}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all duration-200"
            >
              <span>🔒</span> 확인했습니다
            </button>
          </div>
        </div>
      )}

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
          사업자 섹션 (수입 섹션 위)
      ══════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
          <span>🏢</span> 사업자 정보
        </h2>

        {analyzingBusiness ? (
          /* OCR 분석 중 */
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <p className="text-sm text-white/60">사업자등록증 분석 중...</p>
          </div>
        ) : businessInfo?.business_name ? (
          /* 등록 완료 상태 */
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-semibold text-white truncate">✅ {businessInfo.business_name}</p>
                {businessInfo.business_number && (
                  <p className="text-xs text-white/50">{businessInfo.business_number}</p>
                )}
                {businessInfo.owner_name && (
                  <p className="text-xs text-white/40">대표자: {businessInfo.owner_name}</p>
                )}
              </div>
              {/* 수정 버튼 = 재업로드 */}
              <button
                onClick={() => businessFileRef.current?.click()}
                disabled={uploadingBusiness || !approvedUserId}
                className="shrink-0 text-xs text-white/40 hover:text-white/70 underline disabled:opacity-50 transition-colors"
              >
                {uploadingBusiness ? "업로드 중..." : "수정하기"}
              </button>
            </div>

            {/* 과세유형 수동 변경 토글 */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/40">과세유형</p>
              <div className="flex gap-2">
                {(["일반과세자", "간이과세자"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => void handleTaxTypeChange(t)}
                    disabled={savingTaxType}
                    className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      businessInfo.tax_type === t
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {t}{businessInfo.tax_type === t ? " 🏷️" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 미등록 상태 */
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-medium text-amber-300">사업자등록증을 먼저 등록해주세요</p>
                <p className="text-xs text-white/40 mt-0.5">정확한 세금 계산을 위해 필요합니다</p>
              </div>
            </div>
            <button
              onClick={() => businessFileRef.current?.click()}
              disabled={uploadingBusiness || !currentUser || !approvedUserId}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-amber-300 transition-all duration-200"
            >
              {uploadingBusiness
                ? <><span>⏳</span>업로드 중...</>
                : <><span>📸</span>사업자등록증 업로드</>
              }
            </button>
            {/* 보안 안내 문구 */}
            <p className="text-[11px] text-white/30 flex items-center gap-1 justify-center pt-0.5">
              <span>🔐</span>
              업로드된 사업자등록증은 암호화되어 본인만 열람 가능합니다
            </p>
          </div>
        )}

        {/* 사업자등록증 파일 input (숨김) — disabled로 중복 업로드 차단 */}
        <input
          ref={businessFileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={uploadingBusiness || analyzingBusiness || !currentUser || !approvedUserId}
          onChange={handleBusinessFileChange}
        />
      </div>

      {/* ══════════════════════════════════════════════
          수입 섹션
      ══════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
          <span>💰</span> 이번 달 수입
          <span className="ml-auto text-[10px] bg-green-900/60 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">
            🔒 나만 볼 수 있음
          </span>
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
        {/* 업로드 버튼 하단 보안 문구 */}
        <p className="text-xs text-gray-400 text-center">🔒 암호화 저장 · 본인만 열람 가능</p>
        {/* disabled로 파일 선택 자체를 차단해 중복 업로드 방지 */}
        <input ref={incomeFileRef} type="file" accept="image/*" capture="environment" className="hidden"
          disabled={uploadingIncome || isAnalyzingIncome || !currentUser || !approvedUserId}
          onChange={handleIncomeFileChange} />

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
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-emerald-400">
                          {(inc.total_amount ?? 0).toLocaleString()}원
                        </span>
                        {/* 다른 항목 삭제 중이면 비활성화 */}
                        <button
                          onClick={() => void handleDeleteIncome(inc)}
                          disabled={deletingIncomeId !== null}
                          className="text-white/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base leading-none"
                          title="삭제"
                        >
                          {deletingIncomeId === inc.id ? "⏳" : "🗑️"}
                        </button>
                      </div>
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
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="flex-1 rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>
              ))}
            </select>
          </div>
          {/* 다운로드 버튼 4개: 엑셀 / PDF / 이메일 / 카카오톡 */}
          <div className="grid grid-cols-4 gap-2">
            {/* 엑셀 */}
            <button
              onClick={() => void handleDownload()}
              disabled={downloading || !currentUser || !approvedUserId}
              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-xs font-semibold text-emerald-300 transition-all duration-200"
            >
              {downloading ? <><span>⏳</span>저장 중</> : <><span>📥</span>엑셀</>}
            </button>

            {/* PDF */}
            <button
              onClick={() => void handlePdfDownload()}
              disabled={downloadingPdf || !currentUser || !approvedUserId}
              className="flex items-center justify-center gap-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-xs font-semibold text-blue-300 transition-all duration-200"
            >
              {downloadingPdf ? <><span>⏳</span>생성 중</> : <><span>📄</span>PDF</>}
            </button>

            {/* 이메일 */}
            <button
              onClick={() => setEmailModalOpen(true)}
              disabled={!currentUser || !approvedUserId}
              className="flex items-center justify-center gap-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-xs font-semibold text-purple-300 transition-all duration-200"
            >
              <span>📧</span>이메일
            </button>

            {/* 카카오톡 공유 — 카카오 노란색 */}
            <button
              onClick={() => void handleKakaoShare()}
              disabled={sharingKakao || !currentUser || !approvedUserId}
              style={{ backgroundColor: "#FEE500", borderColor: "#E6CE00" }}
              className="flex items-center justify-center gap-1 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed py-3 text-xs font-semibold text-gray-900 transition-all duration-200 hover:brightness-95"
            >
              {sharingKakao ? <><span>⏳</span>생성 중</> : <><span>💬</span>카카오</>}
            </button>
          </div>
        </div>

        {/* 영수증 업로드 + 카드명세서 + 직접 입력 */}
        <div className="flex gap-2">
          {/* 영수증 단건 업로드 (OCR) */}
          <button
            onClick={() => expenseFileRef.current?.click()}
            disabled={uploading || isAnalyzingExpense || importingStatement || !currentUser || !approvedUserId}
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

          {/* 카드명세서 일괄 업로드 */}
          <button
            onClick={() => statementFileRef.current?.click()}
            disabled={importingStatement || uploading || isAnalyzingExpense || !currentUser || !approvedUserId}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-5 text-sm font-semibold text-teal-300 transition-all duration-200"
          >
            {importingStatement ? (
              <><span>⏳</span><span className="whitespace-nowrap text-xs">분석 중...</span></>
            ) : (
              <><span>📋</span><span className="whitespace-nowrap">카드명세서</span></>
            )}
          </button>

          {/* 직접 입력 */}
          <button
            onClick={() => { setExpenseForm({ ...EMPTY_EXPENSE_FORM, receipt_date: todayStr() }); setExpenseModalOpen(true) }}
            disabled={!currentUser || !approvedUserId}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-5 text-sm font-semibold text-white/80 transition-all duration-200"
          >
            <span className="text-base">✏️</span>
            <span className="whitespace-nowrap">직접 입력</span>
          </button>
        </div>

        {/* 업로드 버튼 하단 보안 문구 */}
        <p className="text-xs text-gray-400 text-center">🔒 암호화 저장 · 본인만 열람 가능</p>

        {/* 파일 입력 (숨김) — disabled로 중복 업로드 방지 */}
        <input ref={expenseFileRef} type="file" accept="image/*" capture="environment" className="hidden"
          disabled={uploading || isAnalyzingExpense || !currentUser || !approvedUserId}
          onChange={handleExpenseFileChange} />
        {/* 카드명세서 전용 파일 입력 (숨김) */}
        <input ref={statementFileRef} type="file" accept="image/*" className="hidden"
          disabled={importingStatement || !currentUser || !approvedUserId}
          onChange={handleStatementFileChange} />

        {/* 지출 목록 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/60 flex items-center gap-1.5">
            최근 지출
            <span className="ml-auto text-[10px] bg-green-900/60 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">
              🔒 나만 볼 수 있음
            </span>
          </h3>
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

                    {/* 부가세공제 / 경비처리 뱃지 (분석 완료된 항목만) */}
                    {expense.id !== analyzingExpenseId && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          expense.is_deductible
                            ? "bg-green-500/15 border-green-500/30 text-green-400"
                            : "bg-white/5 border-white/10 text-white/30"
                        }`}>
                          부가세공제 {expense.is_deductible ? "✅" : "❌"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          expense.is_expense !== false
                            ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                            : "bg-white/5 border-white/10 text-white/30"
                        }`}>
                          경비처리 {expense.is_expense !== false ? "✅" : "❌"}
                        </span>

                        {/* 국세청 확인 뱃지: vendor_tax_type이 있을 때만 표시 */}
                        {expense.vendor_tax_type && (
                          expense.is_deductible ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/30 text-emerald-400">
                              국세청 확인 ✅
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/15 border-red-500/30 text-red-400">
                              부가세공제 불가 (국세청 확인)
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {/* 국세청 확인된 경우: 과세유형 표시 / 미확인 시: AI 판단 이유 표시 */}
                    {expense.id !== analyzingExpenseId && (
                      expense.vendor_tax_type ? (
                        <p className="text-[10px] text-white/30 mt-1 leading-tight">
                          {expense.vendor_tax_type} · 국세청 실시간 조회
                        </p>
                      ) : expense.deduction_reason ? (
                        <p className="text-[10px] text-white/25 mt-1 leading-tight">
                          {expense.deduction_reason}
                        </p>
                      ) : null
                    )}

                    {/* 영수증 이미지 링크 (서명 URL이 있을 때만) */}
                    {signedUrls[expense.id] && expense.id !== analyzingExpenseId && (
                      <a
                        href={signedUrls[expense.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400/50 hover:text-blue-400 mt-1 inline-block transition-colors"
                      >
                        🖼️ 영수증 보기
                      </a>
                    )}
                  </div>
                  {/* 금액 + 삭제 버튼 */}
                  <div className="flex items-start gap-1.5 shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-white">
                      {(expense.amount ?? 0).toLocaleString()}원
                    </span>
                    {/* 분석 중이거나 다른 항목 삭제 중이면 비활성화 */}
                    <button
                      onClick={() => void handleDeleteExpense(expense)}
                      disabled={expense.id === analyzingExpenseId || deletingExpenseId !== null}
                      className="text-white/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base leading-none"
                      title="삭제"
                    >
                      {deletingExpenseId === expense.id ? "⏳" : "🗑️"}
                    </button>
                  </div>
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

      {/* ══════════════════════════════════════════════
          이메일 발송 모달
      ══════════════════════════════════════════════ */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!sendingEmail) setEmailModalOpen(false) }}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl px-5 py-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">이메일 발송</h2>
              <button
                onClick={() => { if (!sendingEmail) setEmailModalOpen(false) }}
                className="text-white/40 hover:text-white text-xl leading-none"
              >×</button>
            </div>

            {/* 발송 대상 기간 표시 */}
            <p className="text-xs text-white/40">
              {selectedYear}년 {PERIOD_LABELS[selectedPeriod] ?? `${selectedPeriod}월`} 지출내역서를 발송합니다
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50">받는 분 이름 <span className="text-white/30">(선택)</span></label>
              <input
                type="text"
                value={emailForm.name}
                onChange={(e) => setEmailForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="예: 홍길동"
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">이메일 주소 <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="example@email.com"
                className="w-full rounded-xl bg-white/10 border border-white/10 text-white text-sm px-3 py-2.5 placeholder-white/20 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <button
              onClick={() => void handleEmailSend()}
              disabled={sendingEmail}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all duration-200"
            >
              {sendingEmail ? <><span>⏳</span>발송 중...</> : <><span>📧</span>발송하기</>}
            </button>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════
          카드명세서 분석 결과 모달 (3단계 중복 감지)
      ══════════════════════════════════════════════ */}
      {statementModalOpen && statementResult && (() => {
        // 의심 항목 중 사용자가 "그래도 추가" 선택한 것들
        const includedSuspected = statementResult.suspected.filter((_, i) => suspectedIncluded.has(i))
        // 버튼1: 의심 제외 (newItems만)
        const countWithoutSuspected = statementResult.newItems.length
        // 버튼2: 의심 포함 (newItems + 전체 suspected)
        const countWithSuspected = statementResult.newItems.length + statementResult.suspected.length

        const toggleSuspected = (i: number) => {
          setSuspectedIncluded((prev) => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!insertingStatement) { setStatementModalOpen(false); setStatementResult(null) } }}
          >
            <div
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl px-5 py-6 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">📊 카드명세서 분석 결과</h2>
                <button
                  onClick={() => { if (!insertingStatement) { setStatementModalOpen(false); setStatementResult(null) } }}
                  className="text-white/40 hover:text-white text-xl leading-none"
                >×</button>
              </div>

              {/* 요약 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2">
                  <p className="text-lg font-bold text-emerald-400">{statementResult.newItems.length}</p>
                  <p className="text-[10px] text-emerald-300/70 mt-0.5">신규 추가</p>
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 py-2">
                  <p className="text-lg font-bold text-amber-400">{statementResult.suspected.length}</p>
                  <p className="text-[10px] text-amber-300/70 mt-0.5">중복 의심</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 py-2">
                  <p className="text-lg font-bold text-white/40">{statementResult.confirmed.length}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">확실한 중복</p>
                </div>
              </div>

              {/* ✅ 신규 항목 */}
              {statementResult.newItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-400">
                    ✅ 신규 추가: {statementResult.newItems.length}건
                  </p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {statementResult.newItems.map((t, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
                        <span className="text-xs text-emerald-300 truncate">
                          {t.receipt_date} {t.vendor_name}
                        </span>
                        <span className="text-xs text-emerald-400 shrink-0 ml-2">
                          {t.amount.toLocaleString()}원
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ⚠️ 의심 중복 항목 — 항목별 포함/제외 토글 */}
              {statementResult.suspected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-400">
                    ⚠️ 중복 의심: {statementResult.suspected.length}건 — 확인 필요
                  </p>
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {statementResult.suspected.map((t, i) => {
                      const included = suspectedIncluded.has(i)
                      return (
                        <li key={i} className={`rounded-lg border px-3 py-2 transition-colors ${
                          included
                            ? "bg-emerald-500/10 border-emerald-500/25"
                            : "bg-amber-500/8 border-amber-500/25"
                        }`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-white/70 truncate">
                              {t.receipt_date} | {t.vendor_name} |{" "}
                              <span className="font-semibold">{t.amount.toLocaleString()}원</span>
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { if (included) toggleSuspected(i) }}
                              className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                !included
                                  ? "bg-white/10 text-white/60 ring-1 ring-white/20"
                                  : "bg-white/5 text-white/30"
                              }`}
                            >
                              영수증에 이미 있음
                            </button>
                            <button
                              onClick={() => { if (!included) toggleSuspected(i) }}
                              className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                included
                                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                                  : "bg-white/5 text-white/30"
                              }`}
                            >
                              그래도 추가
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {includedSuspected.length > 0 && (
                    <p className="text-[11px] text-amber-300/60">
                      의심 항목 중 {includedSuspected.length}건 추가 선택됨
                    </p>
                  )}
                </div>
              )}

              {/* ❌ 확실한 중복 항목 (자동 제외, 접힌 목록) */}
              {statementResult.confirmed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white/30">
                    ❌ 확실한 중복: {statementResult.confirmed.length}건 (자동 제외)
                  </p>
                  <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {statementResult.confirmed.map((t, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5">
                        <span className="text-xs text-white/30 truncate">
                          {t.receipt_date} {t.vendor_name}
                        </span>
                        <span className="text-xs text-white/20 shrink-0 ml-2">
                          {t.amount.toLocaleString()}원
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {statementResult.newItems.length === 0 && statementResult.suspected.length === 0 && (
                <p className="text-sm text-white/40 text-center py-2">신규 추가할 항목이 없습니다.</p>
              )}

              {/* 하단 버튼 */}
              <div className="space-y-2 pt-1">
                {/* 취소 */}
                <button
                  onClick={() => { setStatementModalOpen(false); setStatementResult(null) }}
                  disabled={insertingStatement}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 py-3 text-sm font-semibold text-white/70 transition-colors"
                >
                  취소
                </button>

                {/* 의심 제외하고 추가 (newItems + 개별 선택된 suspected) */}
                <button
                  onClick={() => void handleStatementInsert([
                    ...statementResult.newItems,
                    ...includedSuspected,
                  ])}
                  disabled={insertingStatement || (countWithoutSuspected === 0 && includedSuspected.length === 0)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
                >
                  {insertingStatement
                    ? <><span>⏳</span>추가 중...</>
                    : `의심항목 제외하고 ${countWithoutSuspected + includedSuspected.length}건 추가`
                  }
                </button>

                {/* 의심 항목 전체 포함 추가 */}
                {statementResult.suspected.length > 0 && (
                  <button
                    onClick={() => void handleStatementInsert([
                      ...statementResult.newItems,
                      ...statementResult.suspected,
                    ])}
                    disabled={insertingStatement || countWithSuspected === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-amber-300 transition-all duration-200"
                  >
                    {insertingStatement
                      ? <><span>⏳</span>추가 중...</>
                      : `의심항목 포함 ${countWithSuspected}건 추가`
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}
