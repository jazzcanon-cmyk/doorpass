export interface Memo {
  id: number
  date: string
  content: string
  is_private: boolean
  kakao_id: string | null
  author: string
  color: string
}

export interface CalendarProps {
  kakaoId?: string
  userName?: string
}
