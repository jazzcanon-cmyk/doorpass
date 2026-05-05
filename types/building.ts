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
}

export type TabType = "nearby" | "search" | "board"

/** 건물 비밀번호 노출 여부 (메인 페이지에서 /api/users/me 기준으로 한 번 결정) */
export type PasswordAccess = "checking" | "full" | "masked_user" | "masked_guest"
