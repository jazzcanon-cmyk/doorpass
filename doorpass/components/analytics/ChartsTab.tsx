"use client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts"
import { SmallToggle } from "./AnalyticsControls"
import { formatHour } from "@/lib/analytics-utils"
import { CHART_COLORS, type ChartView, type DailyPoint, type HourlyPoint } from "@/types/analytics"

interface ChartsTabProps {
  chartView: ChartView
  onChartViewChange: (v: ChartView) => void
  dailyActivity: DailyPoint[]
  hourlyActivity: HourlyPoint[]
}

export function ChartsTab({ chartView, onChartViewChange, dailyActivity, hourlyActivity }: ChartsTabProps) {
  const maxHourly = Math.max(...hourlyActivity.map(h => h.count), 1)

  return (
    <div className="space-y-4">
      <SmallToggle
        options={[
          { key: "trend",   label: "7일 트렌드" },
          { key: "hourly",  label: "시간대별" },
          { key: "heatmap", label: "히트맵" },
        ]}
        value={chartView}
        onChange={v => onChartViewChange(v as ChartView)}
      />

      {chartView === "trend" && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-3">최근 7일 활동 유형별</p>
          {dailyActivity.every(d => d.total === 0) ? (
            <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="search" stroke={CHART_COLORS.search} name="검색"   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="view"   stroke={CHART_COLORS.view}   name="조회"   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="click"  stroke={CHART_COLORS.click}  name="클릭"   strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {chartView === "hourly" && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-3">최근 24시간 활동</p>
          {hourlyActivity.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourlyActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={formatHour}
                />
                <Bar dataKey="count" name="활동" fill={CHART_COLORS.search} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {chartView === "heatmap" && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-3">시간대별 활동 히트맵 (최근 24h)</p>
          {hourlyActivity.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">데이터 없음</p>
          ) : (
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 24 }, (_, h) => {
                const iso = hourlyActivity.find(a => {
                  const hour = new Date(a.hour + ":00:00Z").getUTCHours()
                  return hour === h
                })
                const count = iso?.count ?? 0
                const intensity = Math.min(count / maxHourly, 1)
                return (
                  <div key={h} className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-full aspect-square rounded-sm transition-colors"
                      style={{ background: `rgba(129, 140, 248, ${0.1 + intensity * 0.9})` }}
                      title={`${h}시: ${count}건`}
                    />
                    {h % 4 === 0 && (
                      <span className="text-[8px] text-muted-foreground">{h}시</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
