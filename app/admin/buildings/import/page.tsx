import { requireAdmin } from "@/lib/auth"
import { BuildingImportPage } from "./BuildingImportPage"

export default async function Page() {
  await requireAdmin()
  return <BuildingImportPage />
}
