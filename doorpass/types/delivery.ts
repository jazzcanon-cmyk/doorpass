export type DeliveryVolume = "v50" | "v100" | "v200" | "v300" | "v400" | "v500"
export type DeliveryPayType = "per_item" | "per_day" | "negotiable"
export type DeliveryStatus = "open" | "matched" | "closed"
export type ApplicationStatus = "pending" | "accepted" | "rejected"

export interface DeliveryRequest {
  id: number | string
  requester_email: string
  requester_name: string | null
  branch_id: string | null
  branch_name?: string | null
  request_date: string
  volume: DeliveryVolume
  pay_type: DeliveryPayType
  pay_amount: number | null
  area: string | null
  memo: string | null
  contact: string | null
  status: DeliveryStatus
  matched_email: string | null
  matched_name: string | null
  created_at: string
  updated_at?: string
  application_count?: number
  my_application_status?: ApplicationStatus | null
}

export interface DeliveryApplication {
  id: number | string
  request_id: number | string
  applicant_email: string
  applicant_name: string | null
  message: string | null
  status: ApplicationStatus
  created_at: string
}

export const VOLUME_LABEL: Record<DeliveryVolume, string> = {
  v50: "50개 이하",
  v100: "50 ~ 100개",
  v200: "100 ~ 200개",
  v300: "200 ~ 300개",
  v400: "300 ~ 400개",
  v500: "400 ~ 500개 이상",
}

export const VOLUME_OPTIONS: { value: DeliveryVolume; label: string }[] = [
  { value: "v50", label: "50개 이하" },
  { value: "v100", label: "50 ~ 100개" },
  { value: "v200", label: "100 ~ 200개" },
  { value: "v300", label: "200 ~ 300개" },
  { value: "v400", label: "300 ~ 400개" },
  { value: "v500", label: "400 ~ 500개 이상" },
]

export const PAY_TYPE_LABEL: Record<DeliveryPayType, string> = {
  per_item: "건당",
  per_day: "일당",
  negotiable: "협의",
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  open: "모집중",
  matched: "매칭완료",
  closed: "마감",
}

export const STATUS_COLOR: Record<DeliveryStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  matched: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  closed: "bg-white/10 text-white/40 border-white/10",
}
