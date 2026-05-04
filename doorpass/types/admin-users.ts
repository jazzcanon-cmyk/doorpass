export interface ApprovedUser {
  id: number
  kakao_id: string | null
  name: string
  phone: string | null
  email: string | null
  role: "admin" | "sub_admin" | "editor" | "driver"
  is_active: boolean
  created_at: string
  managed_region?: string | null
  branch_id?: string | null
  branches?: { id: string; name: string; region: string; type?: string | null } | null
}

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  provider: string
  created_at: string
  last_sign_in_at: string | null
  role: string | null
  is_active: boolean | null
  is_registered: boolean
  approved_id: number | null
  is_blocked: boolean
  blocked_reason: string | null
}

export type AdminUserTab = "all" | "manage"
export type ApprovedRowMode = "pending" | "approved"
