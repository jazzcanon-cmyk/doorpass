export type DeliveryVolume = "small" | "medium" | "large"
export type DeliveryPriceType = "per_item" | "per_day" | "negotiable"
export type DeliveryStatus = "open" | "matched" | "closed"
export type ApplicationStatus = "pending" | "accepted" | "rejected"

export interface DeliveryRequest {
  id: number | string
  user_email: string
  user_name: string | null
  branch_id: string | null
  branch_name?: string | null
  delivery_date: string
  volume: DeliveryVolume
  price_type: DeliveryPriceType
  price_amount: number | null
  area_description: string | null
  memo: string | null
  contact: string | null
  status: DeliveryStatus
  matched_email: string | null
  view_count: number | null
  created_at: string
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
  small: "소량 (50개 이하)",
  medium: "중량 (50~100개)",
  large: "대량 (100개 이상)",
}

export const PRICE_TYPE_LABEL: Record<DeliveryPriceType, string> = {
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
