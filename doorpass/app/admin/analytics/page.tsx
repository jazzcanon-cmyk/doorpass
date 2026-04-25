import { requireAdmin } from "@/lib/auth"
import { AnalyticsDashboard } from "./AnalyticsDashboard"

export default async function AnalyticsPage() {
  await requireAdmin()
  return <AnalyticsDashboard />
}
