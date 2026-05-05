"use client"
import { ago } from "@/lib/date-utils"
import type { UserStat } from "@/types/analytics"

export function UsersTab({ userStats }: { userStats: UserStat[] }) {
  if (userStats.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground text-sm">
        사용자 데이터 없음
        <span className="block text-[11px] mt-1 text-muted-foreground/60">검색 시 이메일이 수집되면 표시됩니다</span>
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium">사용자</th>
            <th className="text-center py-2 px-2 font-medium">검색</th>
            <th className="text-center py-2 px-2 font-medium">조회</th>
            <th className="text-center py-2 px-2 font-medium">클릭</th>
            <th className="text-center py-2 px-2 font-medium">합계</th>
            <th className="text-right py-2 px-3 font-medium">마지막 활동</th>
          </tr>
        </thead>
        <tbody>
          {userStats.map((u, i) => (
            <tr key={u.email} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-center">{i + 1}</span>
                  <span className="truncate max-w-[120px] font-medium" title={u.email}>
                    {u.email.split("@")[0]}
                  </span>
                </div>
              </td>
              <td className="text-center py-2 px-2 tabular-nums">{u.searches}</td>
              <td className="text-center py-2 px-2 tabular-nums">{u.views}</td>
              <td className="text-center py-2 px-2 tabular-nums">{u.clicks}</td>
              <td className="text-center py-2 px-2 font-bold tabular-nums">{u.total}</td>
              <td className="text-right py-2 px-3 text-muted-foreground">{ago(u.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
