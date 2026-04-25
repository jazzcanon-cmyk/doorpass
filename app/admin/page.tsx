import { requireAdmin } from "@/lib/auth"
import { AdminContent } from "./AdminContent"

export default async function AdminPage() {
  await requireAdmin()
  return <AdminContent />
}
