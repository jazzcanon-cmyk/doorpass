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

// 날짜 시드 기반 결정론적 랜덤
function seededRand(seed: number): number {
  return Math.abs(Math.sin(seed) * 10000) % 1
}

function getDailyFortune() {
  const now = new Date()
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()

  const deliveryTexts = ["최고의 배송운!", "좋은 하루", "보통의 하루", "집중이 필요한 날", "체력 관리 필요"]
  const zones = ["동쪽", "서쪽", "남쪽", "북쪽", "중앙", "이북", "이남", "이서"]
  const quotes = [
    "오늘 배송보다 내일의 배송이 더 빛납니다.",
    "작은 친절이 큰 기회로 돌아옵니다.",
    "서두르지 말고 꼼꼼하게 배송하면 좋은 일이 생깁니다.",
    "한 번의 실수가 큰 성과로 바뀔 수 있습니다.",
    "오늘도 수고하셨습니다. 내일도 화이팅!",
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
    <div className="border-t border-white/10 pt-3 space-y-1.5">
      <p className="text-xs text-white/40 text-center uppercase tracking-wider">오늘의 배송운</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">배송운</span>
        <span className="text-sm">
          {"⭐".repeat(stars)}{" "}
          <span className="text-white/80">{deliveryText}</span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">행운의 방향</span>
        <span className="text-sm text-white/90">→ {zone}</span>
      </div>
      <p className="text-xs text-white/50 italic text-center pt-0.5">"{quote}"</p>
    </div>
  )
}

interface Sector {
  label: string
  sub: string
  bg: string
  text: string
}

const SECTORS: Sector[] = [
  { label: "10P", sub: "보통", bg: "#3b82f6", text: "#ffffff" },
  { label: "20P", sub: "보통", bg: "#0ea5e9", text: "#ffffff" },
  { label: "30P", sub: "행운", bg: "#22c55e", text: "#ffffff" },
  { label: "50P", sub: "대박", bg: "#a855f7", text: "#ffffff" },
  { label: "100P", sub: "잭팟!", bg: "#facc15", text: "#1f2937" },
  { label: "10P", sub: "보통", bg: "#3b82f6", text: "#ffffff" },
  { label: "20P", sub: "보통", bg: "#0ea5e9", text: "#ffffff" },
  { label: "30P", sub: "행운", bg: "#22c55e", text: "#ffffff" },
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

// SVG 내부 좌표계 (viewBox 기준 300x300 고정)
const CX = 150
const CY = 150
const RADIUS = 140

function sectorPath(i: number): string {
  const start = (i * SECTOR_DEG - 90) * (Math.PI / 180)
  const end = ((i + 1) * SECTOR_DEG - 90) * (Math.PI / 180)
  const x1 = CX + RADIUS * Math.cos(start)
  const y1 = CY + RADIUS * Math.sin(start)
  const x2 = CX + RADIUS * Math.cos(end)
  const y2 = CY + RADIUS * Math.sin(end)
  return `M${CX},${CY} L${x1},${y1} A${RADIUS},${RADIUS} 0 0,1 ${x2},${y2} Z`
}

function labelPosition(i: number) {
  const angle = (i * SECTOR_DEG + SECTOR_DEG / 2 - 90) * (Math.PI / 180)
  const r = RADIUS * 0.62
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
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

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (open) {
      setPhase("idle")
      setRotation(0)
      setResult(null)
      setErrorMsg("")
    }
  }, [open])

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

    // 보너스 보상: 룰렛 없이, 바로 화면
    if (data.rewardType === "bonus_7day" || data.rewardType === "bonus_30day") {
      setPhase("bonus")
      return
    }

    // 룰렛 회전: 결과 섹터로 멈춤
    const sectorIdx = targetSector(
      data.rewardType ?? "common",
      data.rewardPoints ?? 10
    )
    const sectorCenter = sectorIdx * SECTOR_DEG + SECTOR_DEG / 2
    const finalRotation = 360 * 5 + (360 - sectorCenter)
    setRotation(finalRotation)

    // 애니메이션 완료 후 결과 표시
    setTimeout(() => setPhase("result"), 3200)
  }

  const isBonus = phase === "bonus"
  const showResult = phase === "result" || phase === "bonus"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="bg-slate-900 border-white/10 text-white w-[92vw] max-w-sm mx-auto p-0 rounded-2xl flex flex-col max-h-[88vh]"
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 text-white/60 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1 transition-colors"
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pt-4 pb-3 text-center flex-shrink-0 rounded-t-2xl">
          <div className="text-3xl mb-1">🎰</div>
          <DialogTitle className="text-lg font-bold text-white">
            오늘의 출석 체크
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-blue-100 text-sm">
            🎯 {consecutiveDays > 0 ? `${consecutiveDays}일 연속 출석 중!` : "첫 출석!"}
          </DialogDescription>
        </div>

        <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1">

          {/* 연속 출석 진행바 (7일 기준) */}
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>연속 보너스까지</span>
              <span>
                {Math.min(((consecutiveDays + (showResult ? 1 : 0)) % 7) || 7, 7)}/7
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
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
            <div
              className="relative mx-auto"
              style={{ width: "min(260px, 78vw)", height: "calc(min(260px, 78vw) + 20px)" }}
            >
              {/* 화살표 (12시 방향) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 z-10"
                style={{ top: 0 }}
                aria-hidden
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "12px solid transparent",
                    borderRight: "12px solid transparent",
                    borderTop: "20px solid #ef4444",
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
                  right: 0,
                  bottom: 0,
                  transform: `rotate(${rotation}deg)`,
                  transition: phase === "spinning" || phase === "result"
                    ? "transform 3s cubic-bezier(0.17, 0.67, 0.21, 0.99)"
                    : "none",
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 300 300">
                  {SECTORS.map((s, i) => {
                    const pos = labelPosition(i)
                    return (
                      <g key={i}>
                        <path
                          d={sectorPath(i)}
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
                  <circle cx={CX} cy={CY} r="22" fill="#0f172a" stroke="#fff" strokeWidth="3" />
                  <text x={CX} y={CY} fill="#fff" fontSize="16" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                    🎯
                  </text>
                </svg>
              </div>
            </div>
          )}

          {/* 보너스 보상 화면 */}
          {isBonus && result && (
            <>
              <div className="text-center py-4">
                <div className="text-5xl mb-2">
                  {result.rewardType === "bonus_30day" ? "🏆" : "🎁"}
                </div>
                <p className="text-2xl font-extrabold text-amber-400">
                  {result.rewardPoints?.toLocaleString()}P 보너스!
                </p>
                <p className="mt-1.5 text-sm text-white/70">
                  {result.rewardType === "bonus_30day"
                    ? "30일 연속 출석을 달성했습니다!"
                    : "7일 연속 출석 보너스입니다!"}
                </p>
              </div>
              <DailyFortune />
            </>
          )}

          {/* 결과 메시지 */}
          {phase === "result" && result && (
            <>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-sm text-white/60 mb-1">획득 포인트</p>
                <p className="text-3xl font-extrabold text-amber-400">
                  +{result.rewardPoints?.toLocaleString() ?? 0}P
                </p>
                {typeof result.newTotal === "number" && (
                  <p className="mt-1.5 text-xs text-white/50">
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
              ? "내일도 잊지 말고 출석하세요! 🎯"
              : "버튼을 눌러 룰렛을 돌려보세요!"}
          </p>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-5 flex-shrink-0">
          {phase === "idle" && (
            <Button
              onClick={() => void handleSpin()}
              className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-95"
            >
              룰렛 돌리기 🎰
            </Button>
          )}
          {phase === "spinning" && (
            <Button
              disabled
              className="w-full h-12 text-base bg-slate-700 text-white/60 font-bold rounded-xl"
            >
              룰렛 회전 중..
            </Button>
          )}
          {(phase === "result" || phase === "bonus" || phase === "error") && (
            <Button
              onClick={onClose}
              className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 active:scale-95"
            >
              확인
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
