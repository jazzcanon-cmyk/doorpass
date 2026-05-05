import { toast } from "sonner"

export async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append("file", file)
  const r = await fetch("/api/upload/files", { method: "POST", body: fd })
  const d = await r.json()
  if (!r.ok) { toast.error(d.error || "업로드 실패"); return null }
  return d.url as string
}
