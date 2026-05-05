export interface Post {
  id: number
  title: string
  author: string
  created_at: string
  view_count: number
  image_url?: string
}

export interface Comment {
  id: number
  content: string
  author: string
  created_at: string
  like_count: number
  liked?: boolean
}

export interface Notice {
  id: number
  title: string
  content: string
  author: string
  is_important: boolean
  created_at: string
}

export interface Resource {
  id: number
  title: string
  description?: string
  resource_type: string
  url?: string
  author: string
  created_at: string
}

export type BoardTab = "notices" | "resources" | "posts"

export interface BoardCurrentUser {
  userName: string
  email?: string
  userId?: string
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  link: "링크",
  file: "파일",
  image: "이미지",
  document: "문서",
  text: "글",
}
