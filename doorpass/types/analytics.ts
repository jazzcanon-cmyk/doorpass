import type { ElementType } from "react"
import { Search, Building2, FileText, MousePointer2, Activity } from "lucide-react"

export interface PopularSearch  { query: string; search_count: number }
export interface BuildingRank   { building_id: string; building_name: string; view_count: number; unique_users: number }
export interface RecentActivity { id: number; action_type: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }
export interface HourlyPoint    { hour: string; count: number }
export interface DailyPoint     { date: string; search: number; view: number; click: number; total: number }
export interface TypeCount      { type: string; count: number }
export interface UserStat       { email: string; searches: number; clicks: number; views: number; total: number; lastActivity: string }

export interface Stats {
  popularSearches:  PopularSearch[]
  popularBuildings: BuildingRank[]
  recentActivities: RecentActivity[]
  hourlyActivity:   HourlyPoint[]
  dailyActivity:    DailyPoint[]
  activityByType:   TypeCount[]
  userStats:        UserStat[]
  totalToday:       number
}

export type AnalyticsTab = "searches" | "buildings" | "users" | "recent" | "chart"
export type ChartView = "trend" | "hourly" | "heatmap"

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  search:        "검색",
  building_view: "건물 조회",
  post_view:     "게시글 조회",
  button_click:  "버튼 클릭",
  page_view:     "페이지 뷰",
}

export const ACTIVITY_TYPE_ICON: Record<string, ElementType> = {
  search:        Search,
  building_view: Building2,
  post_view:     FileText,
  button_click:  MousePointer2,
  page_view:     Activity,
}

export const CHART_COLORS = { search: "#818cf8", view: "#34d399", click: "#fb923c" }
