import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { sendTelegramMessage } from "@/lib/telegram"

const VOLUMES = ["small", "medium", "large"] as const
const PRICE_TYPES = ["per_item", "per_day", "negotiable"] as const

export async function GET(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const branchId = searchParams.get("branchId")
  const date = searchParams.get("date")
  const mine = searchParams.get("mine") === "1"
  const applied = searchParams.get("applied") === "1"

  try {
    let q = supabaseAdmin.from("delivery_requests").select("*")

    if (mine) q = q.eq("user_email", user!.email!)
    if (status) q = q.eq("status", status)
    if (branchId) q = q.eq("branch_id", branchId)
    if (date) q = q.eq("delivery_date", date)

    const { data: requests, error } = await q.order("created_at", { ascending: false }).limit(200)
    if (error) throw error

    const list = (requests ?? []) as Array<Record<string, unknown>>

    // 내가 신청한 목록 필터 (별도 쿼리)
    let appliedRequestIds = new Set<string | number>()
    if (applied || list.length > 0) {
      const { data: myApps } = await supabaseAdmin
        .from("delivery_applications")
        .select("request_id, status")
        .eq("applicant_email", user!.email!)
      const myAppMap = new Map<string | number, string>()
      ;(myApps ?? []).forEach((a) => {
        const r = a as { request_id: number | string; status: string }
        myAppMap.set(r.request_id, r.status)
        appliedRequestIds.add(r.request_id)
      })

      for (const r of list) {
        const id = r.id as number | string
        ;(r as Record<string, unknown>).my_application_status = myAppMap.get(id) ?? null
      }
    }

    if (applied) {
      const filtered = list.filter((r) => appliedRequestIds.has(r.id as number | string))
      // application_count
      await attachCounts(filtered)
      await attachBranchNames(filtered)
      return NextResponse.json({ requests: filtered })
    }

    await attachCounts(list)
    await attachBranchNames(list)
    return NextResponse.json({ requests: list })
  } catch (error) {
    console.error("[Delivery GET] 오류:", error)
    return NextResponse.json({ error: "조회 실패" }, { status: 500 })
  }
}

async function attachCounts(list: Array<Record<string, unknown>>) {
  if (list.length === 0) return
  const ids = list.map((r) => r.id)
  const { data: apps } = await supabaseAdmin
    .from("delivery_applications")
    .select("request_id")
    .in("request_id", ids as (number | string)[])
  const counts = new Map<string | number, number>()
  ;(apps ?? []).forEach((a) => {
    const id = (a as { request_id: number | string }).request_id
    counts.set(id, (counts.get(id) ?? 0) + 1)
  })
  for (const r of list) {
    r.application_count = counts.get(r.id as number | string) ?? 0
  }
}

async function attachBranchNames(list: Array<Record<string, unknown>>) {
  if (list.length === 0) return
  const branchIds = Array.from(
    new Set(list.map((r) => r.branch_id).filter((x): x is string => typeof x === "string" && x.length > 0))
  )
  if (branchIds.length === 0) return
  const { data: branches } = await supabaseAdmin
    .from("branches")
    .select("id, name")
    .in("id", branchIds)
  const map = new Map<string, string>()
  ;(branches ?? []).forEach((b) => {
    const r = b as { id: string; name: string }
    map.set(r.id, r.name)
  })
  for (const r of list) {
    const id = r.branch_id as string | null
    r.branch_name = id ? map.get(id) ?? null : null
  }
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const {
      branchId,
      deliveryDate,
      volume,
      priceType,
      priceAmount,
      areaDescription,
      memo,
      contact,
    } = body as {
      branchId?: string
      deliveryDate?: string
      volume?: string
      priceType?: string
      priceAmount?: number | string
      areaDescription?: string
      memo?: string
      contact?: string
    }

    if (!deliveryDate) return NextResponse.json({ error: "날짜 필요" }, { status: 400 })
    if (!volume || !VOLUMES.includes(volume as (typeof VOLUMES)[number])) {
      return NextResponse.json({ error: "물량 선택 필요" }, { status: 400 })
    }
    if (!priceType || !PRICE_TYPES.includes(priceType as (typeof PRICE_TYPES)[number])) {
      return NextResponse.json({ error: "단가 방식 필요" }, { status: 400 })
    }
    if (!contact?.trim()) return NextResponse.json({ error: "연락처 필요" }, { status: 400 })

    const amount =
      priceType === "negotiable"
        ? null
        : Number(priceAmount) > 0
        ? Math.floor(Number(priceAmount))
        : null

    // 요청자 branch_id 자동 보충
    let resolvedBranchId = branchId?.trim() || null
    if (!resolvedBranchId) {
      const { data: me } = await supabaseAdmin
        .from("approved_users")
        .select("branch_id")
        .eq("email", user!.email!)
        .maybeSingle()
      resolvedBranchId = (me as { branch_id?: string } | null)?.branch_id ?? null
    }

    const userName =
      (user!.user_metadata?.name as string | undefined) ||
      (user!.user_metadata?.full_name as string | undefined) ||
      user!.email!

    const { data, error } = await supabaseAdmin
      .from("delivery_requests")
      .insert({
        user_email: user!.email!,
        user_name: userName,
        branch_id: resolvedBranchId,
        delivery_date: deliveryDate,
        volume,
        price_type: priceType,
        price_amount: amount,
        area_description: areaDescription?.trim() || null,
        memo: memo?.trim() || null,
        contact: contact.trim(),
        status: "open",
        view_count: 0,
      })
      .select()
      .single()

    if (error) throw error

    sendTelegramMessage(
      `🚚 [대리배송 등록]\n날짜: ${deliveryDate}\n물량: ${volume}\n단가: ${priceType}${amount ? ` ${amount}원` : ""}\n등록자: ${userName}`
    ).catch(console.error)

    return NextResponse.json({ request: data })
  } catch (error) {
    console.error("[Delivery POST] 오류:", error)
    return NextResponse.json({ error: "등록 실패" }, { status: 500 })
  }
}
