import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"
import { sendPushToUser } from "@/lib/push"

const CATEGORIES = ["bug", "feature", "complaint", "password_error", "general"] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_LABEL: Record<Category, string> = {
  bug: "🐛 버그",
  feature: "💡 기능요청",
  complaint: "😤 불편사항",
  password_error: "⚠️ 비밀번호 오류",
  general: "💬 기타",
}

const DAILY_LIMIT = 5

interface FeedbackRow {
  id: number
  user_email: string
  user_name: string | null
  category: Category
  building_id: number | null
  building_name: string | null
  content: string
  status: "new" | "reading" | "resolved" | "rejected"
  admin_reply: string | null
  replied_at: string | null
  replied_by: string | null
  created_at: string
}

// ─── POST: 피드백 등록 ──────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const email = user?.email
    if (!email) {
      return NextResponse.json({ error: "이메일 정보가 필요합니다." }, { status: 400 })
    }

    let body: {
      category?: string
      content?: string
      building_id?: number | null
      building_name?: string | null
    } = {}
    try {
      body = await request.json()
    } catch {}

    const category = (body.category ?? "general") as Category
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "잘못된 분류입니다." }, { status: 400 })
    }

    const content = String(body.content ?? "").trim()
    if (!content) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: "내용은 2000자 이하로 작성해주세요." }, { status: 400 })
    }

    // 일일 5건 제한 (스팸 방지)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin
      .from("feedbacks")
      .select("id", { count: "exact", head: true })
      .eq("user_email", email)
      .gte("created_at", startOfDay.toISOString())

    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `하루 ${DAILY_LIMIT}건까지만 보낼 수 있어요. 내일 다시 시도해주세요.` },
        { status: 429 }
      )
    }

    // 표시용 이름
    const { data: approved } = await supabaseAdmin
      .from("approved_users")
      .select("name")
      .eq("email", email)
      .maybeSingle()
    const userName: string =
      (approved?.name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      email.split("@")[0]

    // building_id 정규화 (password_error 일 때만 사용)
    const buildingId =
      category === "password_error" && Number.isFinite(Number(body.building_id))
        ? Number(body.building_id)
        : null
    const buildingName =
      category === "password_error" ? (body.building_name?.trim() || null) : null

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("feedbacks")
      .insert({
        user_email: email,
        user_name: userName,
        category,
        building_id: buildingId,
        building_name: buildingName,
        content,
        status: "new",
      })
      .select("id")
      .single()

    if (insertError || !inserted) {
      console.error("[feedbacks:create] insert 실패:", (insertError as Error).message)
      return NextResponse.json({ error: "전송에 실패했습니다." }, { status: 500 })
    }

    // 관리자 텔레그램 알림 (fire-and-forget)
    void sendTelegramMessage(
      [
        category === "password_error" ? "⚠️ 비밀번호 오류 신고" : "💬 새 피드백",
        `분류: ${CATEGORY_LABEL[category]}`,
        `회원: ${userName} (${email})`,
        buildingName ? `건물: ${buildingName}` : null,
        `내용: ${content.slice(0, 200)}${content.length > 200 ? "…" : ""}`,
      ]
        .filter(Boolean)
        .join("\n"),
      "new_user_notification"
    ).catch(console.error)

    // 비밀번호 오류 신고는 해당 건물 대리점의 부관리자에게도 푸시
    if (category === "password_error" && buildingId) {
      void notifySubAdminsOfPasswordError({
        buildingId,
        buildingName: buildingName ?? "(미상)",
        reporterName: userName,
        memo: content,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, id: inserted.id })
  } catch (error) {
    console.error("[feedbacks:create] 처리 실패:", (error as Error).message)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

// ─── GET: 내 피드백 이력 ──────────────────────────────────────────────────
export async function GET() {
  try {
    const { user, unauthorized } = await requireAuth()
    if (unauthorized) return unauthorized

    const email = user?.email
    if (!email) return NextResponse.json({ feedbacks: [] })

    const { data, error } = await supabaseAdmin
      .from("feedbacks")
      .select(
        "id, user_email, user_name, category, building_id, building_name, content, status, admin_reply, replied_at, replied_by, created_at"
      )
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) {
      console.error("[feedbacks:list] 조회 실패:", (error as Error).message)
      return NextResponse.json({ feedbacks: [] })
    }

    return NextResponse.json({ feedbacks: (data ?? []) as FeedbackRow[] })
  } catch (error) {
    console.error("[feedbacks:list] 처리 실패:", (error as Error).message)
    return NextResponse.json({ feedbacks: [] })
  }
}

// ─── 헬퍼: 비밀번호 오류 신고 → 해당 건물 부관리자에게 푸시 알림 ────────────
async function notifySubAdminsOfPasswordError(opts: {
  buildingId: number
  buildingName: string
  reporterName: string
  memo: string
}) {
  const { data: building } = await supabaseAdmin
    .from("buildings")
    .select("branch_id")
    .eq("id", opts.buildingId)
    .maybeSingle()

  const branchId = building?.branch_id as string | null | undefined
  if (!branchId) return

  const { data: subAdmins } = await supabaseAdmin
    .from("approved_users")
    .select("email")
    .eq("branch_id", branchId)
    .eq("role", "sub_admin")

  for (const row of subAdmins ?? []) {
    const target = row.email as string | null
    if (!target) continue
    void sendPushToUser(target, {
      title: "⚠️ 비밀번호 오류 신고",
      body: `${opts.reporterName}님이 ${opts.buildingName} 비밀번호 오류를 신고했어요.`,
      url: "/admin/feedbacks",
    }).catch(console.error)
  }
}
