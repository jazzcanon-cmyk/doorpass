"use client"

import { MapPin, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LocationStatusProps {
  loading: boolean
  error: string | null
  location: { lat: number; lng: number } | null
  lastUpdated: Date | null
  buildingCount: number
  onRetry: () => void
}

export function LocationStatus({
  loading,
  error,
  location,
  lastUpdated,
  buildingCount,
  onRetry,
}: LocationStatusProps) {
  if (error) {
    return null
  }

  return (
    <section className="border-b border-border bg-card/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              {!loading && location && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {loading ? "위치 확인 중..." : "현재 위치 기준"}
                </p>
                <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  <Radio className="mr-1 h-3 w-3" />
                  50m
                </span>
              </div>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  {lastUpdated.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  업데이트
                </p>
              )}
            </div>
          </div>

          {!loading && !error && (
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{buildingCount}</p>
              <p className="text-xs text-muted-foreground">건물 발견</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
