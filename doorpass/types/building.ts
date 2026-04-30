export interface Building {
  id: string
  name: string
  address: string
  password: string
  memo?: string
  latitude: number
  longitude: number
  distance?: number
}

export interface CurrentUser {
  userId: string
  userName: string
  email: string
  branchId?: string | null
  /** approved_users 활성 + role 있음 — 건물 비밀번호 평문 노출 */
  canRevealBuildingPassword?: boolean
}

export type TabType = "nearby" | "search" | "board"
