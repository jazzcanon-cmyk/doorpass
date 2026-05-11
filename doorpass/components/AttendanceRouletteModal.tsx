"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type RewardType = "common" | "rare" | "epic" | "jackpot" | "bonus_7day" | "bonus_30day"

interface CheckResponse {
  success: boolean
  reason?: string
  message?: string
  rewardPoints?: number
  rewardType?: RewardType
  consecutiveDays?: number
  isBonusDay?: boolean
  newTotal?: number | null
}

interface Props {
  open: boolean
  consecutiveDays: number
  onClose: () => void
  onChecked?: (result: CheckResponse) => void
}

// 날짜 시드 기반 결정론적 랜덤 (같은 날 = 같은 운세)
function seededRand(seed: number): number {
  return Math.abs(Math.sin(seed) * 10000) % 1
}

function getDailyFortune() {
  const now = new Date()
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()

  const deliveryTexts = ["최고의 배송일!", "순조로운 하루", "보통의 하루", "집중력이 필요한 날", "인내가 필요한 날"]
  const zones = ["삼산동", "신정동", "달동", "옥동", "남구", "중구", "북구", "동구"]
  const quotes = [
    "빠른 배송보다 안전한 배송이 먼저입니다.",
    "고객의 작은 미소가 오늘의 원동력입니다.",
    "잠깐의 휴식이 더 나은 배송을 만듭니다.",
    "한 개 한 개 정성껏, 그게 프로입니다.",
    "오늘 수고한 나 자신에게 박수를 보내세요.",
  ]

  const textIdx = Math.floor(seededRand(seed + 1) * deliveryTexts.length)
  const stars = 3 + Math.floor(seededRand(seed + 2) * 3) // 3~5
  const zoneIdx = Math.floor(seededRand(seed + 3) * zones.length)
  const quoteIdx = Math.floor(seededRand(seed + 4) * quotes.length)

  return {
    stars,
    deliveryText: deliveryTexts[textIdx],
    zone: zones[zoneIdx],
    quote: quotes[quoteIdx],
  }
}

function DailyFortune() {
  const { stars, deliveryText, zone, quote } = getDailyFortune()
  return (
    <div className="border-t border-white/10 pt-4 space-y-2">
      <p className="text-xs text-white/40 text-center uppercase tracking-wider">오늘의 배송운</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">배송운</span>
        <span className="text-sm">
          {"⭐".repeat(stars)}{" "}
          <span className="text-white/80">{deliveryText}</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">행운의 구역</span>
        <span className="text-sm text-white/90">📍 {zone}</span>
      </div>
      <p className="text-xs text-white/50 italic text-center pt-1">"{quote}"</p>
    </div>
  )
}

// 룰렛 칸 정의 (12시 방향에서 시계방향 0~7)
interface Sector {
  label: string
  sub: string
  bg: string
  text: string
}

const SECTORS: Sector[] = [
  { label: "10P", sub: "보통", bg: "#3b82f6", text: "#ffffff" },
  { label: "20P", sub: "보통", bg: "#0ea5e9", text: "#ffffff" },
  { label: "30P", sub: "레어", bg: "#22c55e", text: "#ffffff" },
  { label: "50P", sub: "에픽", bg: "#a855f7", text: "#ffffff" },
  { label: "100P", sub: "잭팟!", bg: "#facc15", text: "#1f2937" },
  { label: "10P", sub: "보통", bg: "#3b82f6", text: "#ffffff" },
  { label: "20P", sub: "보통", bg: "#0ea5e9", text: "#ffffff" },
  { label: "30P", sub: "레어", bg: "#22c55e", text: "#ffffff" },
]

const SECTOR_DEG = 360 / SECTORS.length

function targetSector(rewardType: RewardType, points: number): number {
  if (rewardType === "common") {
    const candidates = points === 20 ? [1, 6] : [0, 5]
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
  if (rewardType === "rare") {
    const candidates = [2, 7]
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
  if (rewardType === "epic") return 3
  if (rewardType === "jackpot") return 4
  return 0
}

// SVG 파이 조각 path 생성
function sectorPath(i: number, radius: number, cx: number, cy: number): string {
  const start = (i * SECTOR_DEG - 90) * (Math.PI / 180)
  const end = ((i + 1) * SECTOR_DEG - 90) * (Math.PI / 180)
  const x1 = cx + radius * Math.cos(start)
  const y1 = cy + radius * Math.sin(start)
  const x2 = cx + radius * Math.cos(end)
  const y2 = cy + radius * Math.sin(end)
  return `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 0,1 ${x2},${y2} Z`
}

function labelPosition(i: number, radius: number, cx: number, cy: number) {
  const angle = (i * SECTOR_DEG + SECTOR_DEG / 2 - 90) * (Math.PI / 180)
  const r = radius * 0.62
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

export function AttendanceRouletteModal({
  open,
  consecutiveDays,
  onClose,
  onChecked,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "bonus" | "result" | "error">("idle")
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>("")

  // 모달 재오픈 시 상태 초기화
  useEffect(() => {
    if (open) {
      setPhase("idle")
      setRotation(0)
      setResult(null)
      setErrorMsg("")
    }
  }, [open])

  const cx = 150
  const cy = 150
  const radius = 140

  async function handleSpin() {
    setPhase("spinning")
    setErrorMsg("")
    let data: CheckResponse | null = null
    try {
      const res = await fetch("/api/attendance/check", { method: "POST" })
      data = (await res.json()) as CheckResponse
      if (!res.ok || !data.success) {
        setErrorMsg(data?.message || "출석 체크에 실패했습니다.")
        setPhase("error")
        return
      }
    } catch (e) {
      console.error("[attendance:spin] 호출 실패:", (e as Error).message)
      setErrorMsg("네트워크 오류로 출석 체크에 실패했습니다.")
      setPhase("error")
      return
    }

    setResult(data)
    onChecked?.(data)

    // 보너스 일자: 룰렛 스킵, 축하 화면
    if (data.rewardType === "bonus_7day" || data.rewardType === "bonus_30day") {
      setPhase("bonus")
      return
    }

    // 룰렛 회전: 결과 섹터에 정지
    const sectorIdx = targetSector(
      data.rewardType ?? "common",
      data.rewardPoints ?? 10
    )
    // 12시 방향 포인터에 sectorIdx 중앙이 오도록: 회전각 = -(sectorIdx * 45 + 22.5)
    // 5바퀴 추가 회전으로 시각적 임팩트
    const sectorCenter = sectorIdx * SECTOR_DEG + SECTOR_DEG / 2
    const finalRotation = 360 * 5 + (360 - sectorCenter)
    setRotation(finalRotation)

    // 회전 애니메이션 종료 후 결과 표시
    setTimeout(() => setPhase("result"), 3200)
  }

  const isBonus = phase === "bonus"
  const showResult = phase === "result" || phase === "bonus"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="bg-slate-900 border-white/10 text-white max-w-sm mx-auto p-0 overflow-hidden rounded-2xl"
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-2">🎯</div>
          <DialogTitle className="text-xl font-bold text-white">
            오늘의 출석 체크
          </DialogTitle>
          <DialogDescription className="mt-1 text-blue-100 text-sm">
            🔥 {consecutiveDays > 0 ? `${consecutiveDays}일 연속 출석 중` : "첫 출석!"}
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* 연속 출석 진행바 (7일 주기) */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1.5">
              <span>이번 주 보너스까지</span>
              <span>
                {Math.min(((consecutiveDays + (showResult ? 1 : 0)) % 7) || 7, 7)}/7
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-700"
                style={{
                  width: `${(((consecutiveDays + (showResult ? 1 : 0)) % 7) || 7) * (100 / 7)}%`,
                }}
              />
            </div>
          </div>

          {/* 룰렛 영역 */}
          {!isBonus && (
            <div className="relative mx-auto" style={{ width: 300, height: 320 }}>
              {/* 포인터 (12시 방향) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 z-10"
                style={{ top: 0 }}
                aria-hidden
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "14px solid transparent",
                    borderRight: "14px solid transparent",
                    borderTop: "22px solid #ef4444",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                  }}
                />
              </div>

              {/* 룰렛 본체 */}
              <div
                className="absolute"
                style={{
                  top: 16,
                  left: 0,
                  width: 300,
                  height: 300,
                  transform: `rotate(${rotation}deg)`,
                  transition: phase === "spinning" || phase === "result"
                    ? "transform 3s cubic-bezier(0.17, 0.67, 0.21, 0.99)"
                    : "none",
                }}
              >
                <svg width="300" height="300" viewBox="0 0 300 300">
                  {SECTORS.map((s, i) => {
                    const pos = labelPosition(i, radius, cx, cy)
                    return (
                      <g key={i}>
                        <path
                          d={sectorPath(i, radius, cx, cy)}
                          fill={s.bg}
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                        <text
                          x={pos.x}
                          y={pos.y - 4}
                          fill={s.text}
                          fontSize="20"
                          fontWeight="700"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {s.label}
                        </text>
                        <text
                          x={pos.x}
                          y={pos.y + 14}
                          fill={s.text}
                          fontSize="11"
                          fontWeight="500"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          opacity="0.85"
                        >
                          {s.sub}
                        </text>
                      </g>
                    )
                  })}
                  <circle cx={cx} cy={cy} r="22" fill="#0f172a" stroke="#fff" strokeWidth="3" />
                  <text x={cx} y={cy} fill="#fff" fontSize="16" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                    🎁
                  </text>
                </svg>
              </div>
            </div>
          )}

          {/* 보너스 일자 축하 화면 */}
          {isBonus && result && (
            <>
              <div className="text-center py-6">
                <div className="text-6xl mb-3">
                  {result.rewardType === "bonus_30day" ? "🏆" : "🎉"}
                </div>
                <p className="text-2xl font-extrabold text-amber-400">
                  {result.rewardPoints?.toLocaleString()}P 보너스!
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {result.rewardType === "bonus_30day"
                    ? "30일 연속 출석을 달성하셨습니다!"
                    : "7일 연속 출석 보너스입니다!"}
                </p>
              </div>
              <DailyFortune />
            </>
          )}

          {/* 결과 메시지 */}
          {phase === "result" && result && (
            <>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-sm text-white/60 mb-1">획득 포인트</p>
                <p className="text-3xl font-extrabold text-amber-400">
                  +{result.rewardPoints?.toLocaleString() ?? 0}P
                </p>
                {typeof result.newTotal === "number" && (
                  <p className="mt-2 text-xs text-white/50">
                    누적 {result.newTotal.toLocaleString()}P
                  </p>
                )}
              </div>
              <DailyFortune />
            </>
          )}

          {phase === "error" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          )}

          <p className="text-xs text-white/40 text-center">
            {showResult
              ? "내일도 잊지 말고 출석해주세요! 🔔"
              : "버튼을 눌러 룰렛을 돌려보세요"}
          </p>
        </div>

        <div className="px-6 pb-6">
          {phase === "idle" && (
            <Button
              onClick={() => void handleSpin()}
              className="w-full h-14 text-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-95"
            >
              룰렛 돌리기 🎰
            </Button>
          )}
          {phase === "spinning" && (
            <Button
              disabled
              className="w-full h-14 text-lg bg-slate-700 text-white/60 font-bold rounded-xl"
            >
              룰렛 회전 중...
            </Button>
          )}
          {(phase === "result" || phase === "bonus" || phase === "error") && (
            <Button
              onClick={onClose}
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95"
            >
              확인
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
