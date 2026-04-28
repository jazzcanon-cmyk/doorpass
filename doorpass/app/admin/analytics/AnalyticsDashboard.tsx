"use client"

import { useState } from "react"
import { Loader2, Search, Building2, BarChart2, Clock, Users } from "lucide-react"
import { useAnalyticsStats } from "@/hooks/useAnalyticsStats"
import { TabBtn } from "@/components/analytics/AnalyticsControls"
import { SummaryCards } from "@/components/analytics/SummaryCards"
import { SearchesTab } from "@/components/analytics/SearchesTab"
import { BuildingsTab } from "@/components/analytics/BuildingsTab"
import { UsersTab } from "@/components/analytics/UsersTab"
import { RecentTab } from "@/components/analytics/RecentTab"
import { ChartsTab } from "@/components/analytics/ChartsTab"
import type { AnalyticsTab, ChartView } from "@/types/analytics"

const TABS: { key: AnalyticsTab; label: string; Icon: React.ElementType }[] = [
  { key: "searches",  label: "인기 검색어",  Icon: Search },
  { key: "buildings", label: "인기 건물",    Icon: Building2 },
  { key: "users",     label: "사용자",       Icon: Users },
  { key: "recent",    label: "최근 활동",    Icon: Clock },
  { key: "chart",     label: "차트",         Icon: BarChart2 },
]

export function AnalyticsDashboard() {
  const { stats, loading, error } = useAnalyticsStats()
  const [tab, setTab] = useState<AnalyticsTab>("searches")
  const [chartView, setChartView] = useState<ChartView>("trend")

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
  if (error || !stats) return (
    <div className="text-center py-12 text-destructive text-sm">{error ?? "오류 발생"}</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">활동 분석</h1>
        <span className="text-xs text-muted-foreground">최근 24h: {stats.totalToday}건</span>
      </div>

      <SummaryCards activityByType={stats.activityByType} />

      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {TABS.map(({ key, label, Icon }) => (
          <TabBtn key={key} active={tab === key} onClick={() => setTab(key)}>
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </TabBtn>
        ))}
      </div>

      {tab === "searches" && <SearchesTab searches={stats.popularSearches} />}
      {tab === "buildings" && <BuildingsTab buildings={stats.popularBuildings} />}
      {tab === "users" && <UsersTab userStats={stats.userStats} />}
      {tab === "recent" && <RecentTab activities={stats.recentActivities} />}
      {tab === "chart" && (
        <ChartsTab
          chartView={chartView}
          onChartViewChange={setChartView}
          dailyActivity={stats.dailyActivity}
          hourlyActivity={stats.hourlyActivity}
        />
      )}
    </div>
  )
}
