import { supabaseAdmin } from "@/lib/supabase-admin"
import { type PointAction } from "@/lib/points"

export type RewardType =
  | "common"
  | "rare"
  | "epic"
  | "jackpot"
  | "bonus_7day"
  | "bonus_30day"

export interface AttendanceResult {
  success: boolean
  reason?: "already_checked" | "error"
  rewardPoints?: number
  rewardType?: RewardType
  consecutiveDays?: number
  isBonusDay?: boolean
  pointAction?: PointAction
}

interface RewardEntry {
  type: Exclude<RewardType, "bonus_7day" | "bonus_30day">
  points: number
  weight: number
}

const REWARD_TABLE: RewardEntry[] = [
  { type: "common", points: 10, weight: 50 },
  { type: "common", points: 20, weight: 25 },
  { type: "rare", points: 30, weight: 15 },
  { type: "epic", points: 50, weight: 8 },
  { type: "jackpot", points: 100, weight: 2 },
]

function pickReward(): RewardEntry {
  const total = REWARD_TABLE.reduce((sum, r) => sum + r.weight, 0)
  let pick = Math.random() * total
  for (const r of REWARD_TABLE) {
    pick -= r.weight
    if (pick <= 0) return r
  }
  return REWARD_TABLE[0]
}

// KST(UTC+9) 기준 오늘 날짜 ISO (YYYY-MM-DD)
export function todayKst(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split("T")[0]
}

function yesterdayKst(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 86400000)
  return kst.toISOString().split("T")[0]
}

function pointActionFor(rewardType: RewardType, points: number): PointAction {
  if (rewardType === "common") {
    return points === 20 ? "attendance_common_20" : "attendance_common_10"
  }
  if (rewardType === "rare") return "attendance_rare"
  if (rewardType === "epic") return "attendance_epic"
  if (rewardType === "jackpot") return "attendance_jackpot"
  if (rewardType === "bonus_7day") return "attendance_bonus_7day"
  return "attendance_bonus_30day"
}

export async function processAttendance(userEmail: string): Promise<AttendanceResult> {
  const today = todayKst()
  const yesterday = yesterdayKst()

  const { data: yesterdayLog } = await supabaseAdmin
    .from("attendance_logs")
    .select("consecutive_days")
    .eq("user_email", userEmail)
    .eq("check_in_date", yesterday)
    .maybeSingle()

  const consecutiveDays = yesterdayLog ? yesterdayLog.consecutive_days + 1 : 1
  const isBonusDay = consecutiveDays > 0 && consecutiveDays % 7 === 0

  let rewardPoints: number
  let rewardType: RewardType

  if (consecutiveDays === 30) {
    rewardPoints = 1000
    rewardType = "bonus_30day"
  } else if (isBonusDay) {
    rewardPoints = 200
    rewardType = "bonus_7day"
  } else {
    const reward = pickReward()
    rewardPoints = reward.points
    rewardType = reward.type
  }

  const { error } = await supabaseAdmin
    .from("attendance_logs")
    .insert({
      user_email: userEmail,
      check_in_date: today,
      consecutive_days: consecutiveDays,
      reward_points: rewardPoints,
      reward_type: rewardType,
      is_bonus_day: isBonusDay,
    })

  if (error) {
    if (error.code === "23505") {
      return { success: false, reason: "already_checked" }
    }
    console.error("[attendance] insert failed:", error.message)
    return { success: false, reason: "error" }
  }

  return {
    success: true,
    rewardPoints,
    rewardType,
    consecutiveDays,
    isBonusDay,
    pointAction: pointActionFor(rewardType, rewardPoints),
  }
}

export async function checkTodayAttendance(userEmail: string): Promise<boolean> {
  const today = todayKst()
  const { data } = await supabaseAdmin
    .from("attendance_logs")
    .select("id")
    .eq("user_email", userEmail)
    .eq("check_in_date", today)
    .maybeSingle()
  return !!data
}

export async function getAttendanceStats(userEmail: string): Promise<{
  consecutiveDays: number
  totalDays: number
  todayChecked: boolean
  monthDates: string[]
}> {
  const today = todayKst()
  const yesterday = yesterdayKst()

  const { data: latest } = await supabaseAdmin
    .from("attendance_logs")
    .select("consecutive_days, check_in_date")
    .eq("user_email", userEmail)
    .order("check_in_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: totalDays } = await supabaseAdmin
    .from("attendance_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_email", userEmail)

  let consecutiveDays = 0
  if (latest) {
    if (latest.check_in_date === today || latest.check_in_date === yesterday) {
      consecutiveDays = latest.consecutive_days
    }
  }

  // 이번 달 출석 날짜
  const monthStart = today.slice(0, 7) + "-01"
  const { data: monthRows } = await supabaseAdmin
    .from("attendance_logs")
    .select("check_in_date")
    .eq("user_email", userEmail)
    .gte("check_in_date", monthStart)
    .order("check_in_date", { ascending: true })

  const monthDates = (monthRows ?? []).map((r) => r.check_in_date as string)

  return {
    consecutiveDays,
    totalDays: totalDays ?? 0,
    todayChecked: latest?.check_in_date === today,
    monthDates,
  }
}
