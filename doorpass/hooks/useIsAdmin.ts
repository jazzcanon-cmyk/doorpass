"use client"
import { useEffect, useState } from "react"

export type CurrentRole = "admin" | "sub_admin" | "editor" | "driver"

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<CurrentRole>("driver")
  const [canEdit, setCanEdit] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        setIsAdmin(!!data?.isAdmin)
        const r: CurrentRole =
          data?.role === "admin" || data?.role === "sub_admin" || data?.role === "editor"
            ? data.role
            : "driver"
        setRole(r)
        setCanEdit(!!data?.canEdit)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  return { isAdmin, role, canEdit, loaded }
}
