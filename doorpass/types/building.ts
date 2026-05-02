export type AccessType = "free" | "password" | "etc"

export interface Building {
  id: string
  name: string
  address: string
  password: string
  memo?: string
  lat: number
  lng: number
  distance?: number
  access_type?: AccessType
}

export interface CurrentUser {
  userId: string
  userName: string
  email: string
  branchId?: string | null
  /** approved_users 활성 + role 있음 — 건물 비밀번호 평문 노출 */
  canRevealBuildingPassword?: boolean
  total_points?: number
}

export type TabType = "nearby" | "search" | "board" | "delivery"
