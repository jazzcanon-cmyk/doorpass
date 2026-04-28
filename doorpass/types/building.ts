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
