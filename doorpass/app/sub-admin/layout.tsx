import { requireManager } from "@/lib/auth"
import SubAdminLayoutClient from "./SubAdminLayoutClient"

export default async function SubAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireManager()
  return <SubAdminLayoutClient>{children}</SubAdminLayoutClient>
}
