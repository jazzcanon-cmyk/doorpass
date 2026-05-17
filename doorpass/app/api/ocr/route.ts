import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { requireAuth, lookupApprovedUser } from "@/lib/auth"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 서비스 롤 키로 직접 DB 업데이트 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExpenseOcrResult {
  receipt_date: string
  amount: number
  vendor_name: string
  category: string
  is_deductible: boolean   // 부가세 매입세액 공제 가능 여부
  is_expense: boolean      // 사업 관련 경비처리 가능 여부
  deduction_reason: string // 판단 이유 한 문장
  b_no: string | null      // 사업자등록번호 (10자리 숫자, 없으면 null)
}

interface IncomeOcrResult {
  income_date: string
  delivery_fee: number
  pickup_fee: number
  incentive: number
  vat_amount: number
  total_amount: number
}

interface BusinessOcrResult {
  business_number: string
  business_name: string
  owner_name: string
  open_date: string
  business_type: string
  business_item: string
  tax_type: string
}

interface SmsOcrResult {
  receipt_date: string
  amount: number
  vendor_name: string
  card_company: string
  approval_number: string | null
  category: string
  is_deductible: boolean
  is_expense: boolean
  deduction_reason: string
}

// 이미지 URL → base64 변환 (공개 URL 또는 외부 URL용)
async function fetchImageBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("이미지 다운로드 실패")
  const buf = await res.arrayBuffer()
  return {
    base64: Buffer.from(buf).toString("base64"),
    mediaType: res.headers.get("content-type") ?? "image/jpeg",
  }
}

// 비공개 Storage 버킷에서 admin 권한으로 이미지 다운로드
async function downloadFromStorage(storagePath: string): Promise<{ base64: string; mediaType: string }> {
  const { data, error } = await supabaseAdmin.storage.from("receipts").download(storagePath)
  if (error || !data) throw new Error("Storage 이미지 다운로드 실패")
  const buf = await data.arrayBuffer()
  return { base64: Buffer.from(buf).toString("base64"), mediaType: data.type || "image/jpeg" }
}

// 공개 URL에서 receipts 버킷 이하 경로 추출 (구형 데이터 호환용)
function extractReceiptsPath(url: string): string | null {
  const marker = "/object/public/receipts/"
  const idx = url.indexOf(marker)
  return idx !== -1 ? url.slice(idx + marker.length) : null
}

export async function POST(req: NextRequest) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized
  try {
    const body = (await req.json()) as {
      imageUrl?: string       // 공개 URL 또는 외부 URL (income/business)
      storagePath?: string    // 비공개 버킷 경로 (expense)
      imageBase64?: string    // base64 직접 전달 (sms)
      imageMediaType?: string // base64 미디어 타입 (sms)
      expenseId?: string
      incomeId?: string
      businessId?: string
      type?: "expense" | "income" | "business" | "sms"
    }

    const { imageUrl, storagePath, type = "expense" } = body

    // ── SMS 카드문자 OCR (별도 경로) ──────────────────────────────────────────
    if (type === "sms") {
      if (!body.imageBase64 && !imageUrl) {
        return NextResponse.json({ error: "imageBase64 또는 imageUrl 필수" }, { status: 400 })
      }

      let smsBase64: string
      let smsMediaType: string
      if (body.imageBase64) {
        smsBase64 = body.imageBase64
        smsMediaType = body.imageMediaType ?? "image/jpeg"
      } else {
        const path = extractReceiptsPath(imageUrl!)
        const r = path ? await downloadFromStorage(path) : await fetchImageBase64(imageUrl!)
        smsBase64 = r.base64; smsMediaType = r.mediaType
      }

      // 이미지 SHA-256 해시 (중복 업로드 감지용)
      const imageHash = createHash("sha256").update(Buffer.from(smsBase64, "base64")).digest("hex")

      // 이 이미지를 이미 처리한 적 있는지 approved_user 기준으로 체크
      let alreadyProcessed = false
      const approvedData = await lookupApprovedUser<{ id: number }>(user!, "id")
      if (approvedData?.id) {
        const { data: existingHash } = await supabaseAdmin
          .from("expenses")
          .select("id")
          .eq("user_id", approvedData.id)
          .eq("image_hash", imageHash)
          .limit(1)
          .maybeSingle()
        alreadyProcessed = !!existingHash
      }

      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
      const smsMessage = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: "한국 카드결제 문자 분석 전문가입니다. JSON만 반환하세요. 다른 말은 하지 마세요.",
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: smsMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: smsBase64,
              },
            },
            {
              type: "text",
              text: `이 이미지는 한국 카드결제 문자 스크린샷입니다.
카드결제 문자의 형식은 다음과 같습니다:
[카드사명] 승인/결제
가맹점명: OOO (또는 가맹점명이 바로 나옴)
금액: OO,OOO원
날짜: YYYY.MM.DD HH:MM

반드시 다음 규칙으로 추출하세요:
1. vendor_name: 가맹점명만 추출 (매우 중요)
   - 반드시 실제 가맹점/상호명만 추출
   - 절대 포함하면 안 되는 단어: 카드, 승인, 결제, 취소, 알림, 안내, 원, 번호, 일시, 잔액, 포인트, 적립
   - 카드사명(BC카드/신한카드/우리카드/국민카드/삼성카드/현대카드/롯데카드/하나카드/농협카드) 제외
   - 금액 숫자 제외
   - 한글 상호명 예시: GS칼텍스, 맥도날드, 이마트, 롯데마트, 스타벅스
   - 영문 상호명도 그대로 추출
   - 상호명을 찾을 수 없으면 '알수없음' 반환
2. amount: 숫자만 (콤마 없이, 원 제외)
3. receipt_date: YYYY-MM-DD 형식 (연도 없으면 ${today.slice(0, 4)} 기준)
4. card_company: 카드사명만
5. approval_number: 승인번호 (없으면 null)
6. category: 아래 기준으로 분류
   - 주유소/충전소/칼텍스/GS/SK에너지 → 유류비
   - 정비/카센터/자동차 → 수리비
   - 식당/카페/맥도날드/편의점 → 식비
   - 통신사/SKT/KT/LG → 통신비
   - 그 외 → 기타
7. is_deductible: 유류비·수리비·통신비면 true
8. is_expense: 업무 관련이면 true
9. deduction_reason: 한국어로 판단 이유

카드결제 문자가 여러 개면 배열로:
{"results": [{"vendor_name": "...", "amount": 숫자, "receipt_date": "YYYY-MM-DD", "card_company": "...", "approval_number": null, "category": "...", "is_deductible": true, "is_expense": true, "deduction_reason": "..."}]}

카드결제 문자가 아니면:
{"error": "카드결제 문자가 아닙니다"}`,
            },
          ],
        }],
      })

      const smsRaw = smsMessage.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")

      const smsMatch = smsRaw.match(/\{[\s\S]*\}/)
      if (!smsMatch) return NextResponse.json({ results: [] })

      const smsParsed = JSON.parse(smsMatch[0]) as { results?: SmsOcrResult[]; error?: string }
      if (smsParsed.error) {
        return NextResponse.json({ error: smsParsed.error }, { status: 422 })
      }
      const validResults = (smsParsed.results ?? []).filter(
        (r) => r.receipt_date && typeof r.amount === "number" && r.vendor_name
      )
      return NextResponse.json({ results: validResults, imageHash, alreadyProcessed })
    }

    // ── 기존 타입 (expense / income / business) ──────────────────────────────
    const recordId =
      type === "income"   ? body.incomeId   :
      type === "business" ? body.businessId :
      body.expenseId

    if ((!imageUrl && !storagePath) || !recordId) {
      return NextResponse.json({ error: "imageUrl 또는 storagePath와 id 필수" }, { status: 400 })
    }

    // 1) 이미지 다운로드 → base64 (비공개 버킷은 admin download, 공개 URL은 fetch)
    let base64: string
    let mediaType: string
    if (storagePath) {
      // expense: Storage 경로 직접 전달 (비공개 버킷)
      const r = await downloadFromStorage(storagePath)
      base64 = r.base64; mediaType = r.mediaType
    } else {
      // income/business: URL 전달 — receipts 버킷 URL이면 admin download, 아니면 fetch
      const path = extractReceiptsPath(imageUrl!)
      if (path) {
        const r = await downloadFromStorage(path)
        base64 = r.base64; mediaType = r.mediaType
      } else {
        const r = await fetchImageBase64(imageUrl!)
        base64 = r.base64; mediaType = r.mediaType
      }
    }

    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    const thisMonth = today.slice(0, 7) + "-01" // YYYY-MM-01

    // 2) 타입별 프롬프트 설정
    const systemPrompt =
      type === "income"   ? "한국 택배 정산명세서 분석 전문가입니다. JSON만 반환하세요."
    : type === "business" ? "한국 사업자등록증 분석 전문가입니다. JSON만 반환하세요."
    : "당신은 한국 영수증 분석 전문가입니다. 영수증 이미지에서 정보를 추출해 JSON만 반환하세요. 다른 말은 하지 마세요."

    const userPrompt =
      type === "income"
        ? `이 정산명세서에서 추출해 JSON으로만 답해:
{
  "income_date": "정산월 (YYYY-MM-DD, 해당월 1일로, 없으면 ${thisMonth})",
  "delivery_fee": 배송수수료 숫자만,
  "pickup_fee": 집하수수료 숫자만 (없으면 0),
  "incentive": 인센티브 숫자만 (없으면 0),
  "vat_amount": 부가세액 숫자만 (없으면 0),
  "total_amount": 합계금액 숫자만
}`
      : type === "business"
        ? `이 사업자등록증에서 추출해 JSON으로만 답해:
{
  "business_number": "사업자등록번호 (000-00-00000 형식)",
  "business_name": "상호명",
  "owner_name": "대표자명",
  "open_date": "개업일 (YYYY-MM-DD)",
  "business_type": "업태",
  "business_item": "종목",
  "tax_type": "과세유형 (문서에 간이과세자 명시되면 간이과세자, 아니면 일반과세자)"
}`
      : `이 영수증에서 다음을 추출해 JSON으로만 답해:
{
  "receipt_date": "날짜 (YYYY-MM-DD, 없으면 ${today})",
  "amount": 합계금액 숫자만 (원 단위),
  "vendor_name": "업체명",
  "category": "유류비|수리비|식비|통신비|기타 중 하나",
  "is_deductible": 부가세 매입세액 공제 가능하면 true (세금계산서/카드매출전표 발행 사업자의 사업용 지출만 true),
  "is_expense": 사업 관련 경비처리 가능하면 true (사업과 관련된 지출이면 대부분 true),
  "deduction_reason": "판단이유 한 문장 (예: 사업용 차량 유류비로 부가세공제 및 경비처리 가능)",
  "b_no": "사업자등록번호 숫자만 10자리 (예: 1234567890), 영수증에 없으면 null"
}`

    // 3) Claude Haiku Vision 호출
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024, // deduction_reason 문장 포함으로 여유 확보
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    })

    // 4) 응답에서 JSON 추출
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "JSON 파싱 실패", raw: rawText }, { status: 422 })
    }

    // 5) 타입별 테이블 업데이트
    if (type === "business") {
      const parsed = JSON.parse(jsonMatch[0]) as BusinessOcrResult
      const { error } = await supabaseAdmin
        .from("business_info")
        .update({
          business_number: parsed.business_number ?? null,
          business_name:   parsed.business_name   ?? null,
          owner_name:      parsed.owner_name       ?? null,
          open_date:       parsed.open_date        ?? null,
          business_type:   parsed.business_type    ?? null,
          business_item:   parsed.business_item    ?? null,
          tax_type:        parsed.tax_type         ?? "일반과세자",
          is_verified:     true,
        })
        .eq("id", recordId)
      if (error) throw error
      return NextResponse.json({ success: true, data: parsed })
    } else if (type === "income") {
      const parsed = JSON.parse(jsonMatch[0]) as IncomeOcrResult
      const { error } = await supabaseAdmin
        .from("income")
        .update({
          income_date: parsed.income_date ?? thisMonth,
          delivery_fee: typeof parsed.delivery_fee === "number" ? parsed.delivery_fee : 0,
          pickup_fee: typeof parsed.pickup_fee === "number" ? parsed.pickup_fee : 0,
          incentive: typeof parsed.incentive === "number" ? parsed.incentive : 0,
          vat_amount: typeof parsed.vat_amount === "number" ? parsed.vat_amount : 0,
          total_amount: typeof parsed.total_amount === "number" ? parsed.total_amount : 0,
        })
        .eq("id", recordId)
      if (error) throw error
      return NextResponse.json({ success: true, data: parsed })
    } else {
      const parsed = JSON.parse(jsonMatch[0]) as ExpenseOcrResult

      // OCR 사업자번호: 하이픈 제거 후 10자리 검증
      const rawBno = parsed.b_no ?? null
      const cleanBno = rawBno ? rawBno.replace(/-/g, "").trim() : null
      const validBno = cleanBno && /^\d{10}$/.test(cleanBno) ? cleanBno : null

      // 1단계: OCR 결과로 expenses 업데이트 (사업자번호 포함)
      const { error } = await supabaseAdmin
        .from("expenses")
        .update({
          receipt_date:     parsed.receipt_date ?? today,
          amount:           typeof parsed.amount === "number" ? parsed.amount : 0,
          vendor_name:      parsed.vendor_name ?? null,
          category:         parsed.category ?? "기타",
          is_deductible:    parsed.is_deductible === true,
          is_expense:       parsed.is_expense !== false,
          deduction_reason: parsed.deduction_reason ?? null,
          business_number:  validBno ?? null,
        })
        .eq("id", recordId)
      if (error) throw error

      // 2단계: 사업자번호가 추출된 경우 국세청 API로 과세유형 실시간 검증
      let ntsResult: { tax_type: string; is_deductible: boolean | null; status: string } | null = null
      if (validBno) {
        try {
          const ntsRes = await fetch(
            `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(process.env.NTS_API_KEY ?? "")}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ b_no: [validBno] }),
            }
          )
          if (ntsRes.ok) {
            const ntsJson = (await ntsRes.json()) as {
              data?: { b_stt_cd: string; tax_type_cd: string; tax_type: string; b_stt: string }[]
            }
            const item = ntsJson.data?.[0]
            if (item) {
              const isActive = item.b_stt_cd === "01"
              const isGeneral = item.tax_type_cd === "01"

              let taxType = "확인필요"
              if (item.tax_type_cd === "01") taxType = "일반과세자"
              else if (item.tax_type_cd === "02") taxType = "간이과세자"
              else if (item.tax_type_cd === "03") taxType = "면세사업자"

              let status = "확인필요"
              if (item.b_stt_cd === "01") status = "계속사업자"
              else if (item.b_stt_cd === "02") status = "휴업자"
              else if (item.b_stt_cd === "03") status = "폐업자"

              // 일반과세자 + 계속사업자일 때만 공제 가능
              const isDeductible = item.tax_type_cd === "" ? null : isGeneral && isActive

              ntsResult = { tax_type: taxType, is_deductible: isDeductible, status }

              // 국세청 결과로 is_deductible / vendor_tax_type 덮어쓰기
              await supabaseAdmin
                .from("expenses")
                .update({
                  vendor_tax_type: taxType,
                  is_deductible:   isDeductible ?? parsed.is_deductible === true,
                })
                .eq("id", recordId)
            }
          }
        } catch (ntsErr) {
          // 국세청 조회 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
          console.warn("국세청 조회 실패 (무시):", ntsErr)
        }
      }

      return NextResponse.json({ success: true, data: { ...parsed, nts: ntsResult } })
    }
  } catch (err) {
    console.error("OCR 오류:", err)
    return NextResponse.json({ error: "OCR 처리 중 오류 발생" }, { status: 500 })
  }
}
