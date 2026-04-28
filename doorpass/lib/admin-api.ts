export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText)
  return data as T
}

export function formatDate(iso: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function providerLabel(provider: string) {
  if (provider === "kakao") return { label: "카카오", cls: "bg-yellow-500/20 text-yellow-300" }
  if (provider === "google") return { label: "구글", cls: "bg-blue-500/20 text-blue-300" }
  return { label: provider, cls: "bg-white/10 text-white/50" }
}
