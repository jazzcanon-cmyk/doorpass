// 관리자 TaxPass 대시보드 — 회원/영수증/세금/알림 현황
// layout.tsx의 requireAdmin() 으로 admin 권한이 이미 강제되므로 본 페이지는 단순 마운트만.
import { TaxpassDashboard } from "./TaxpassDashboard"

export default function TaxpassAdminPage() {
  return <TaxpassDashboard />
}
