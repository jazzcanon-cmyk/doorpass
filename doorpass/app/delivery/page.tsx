"use client"
import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { LoadingScreen } from "@/components/LoadingScreen"
import { DeliveryBoard } from "@/components/delivery/DeliveryBoard"
import { RatingDisplay } from "@/components/RatingDisplay"
import { trackPageView } from "@/lib/analytics"

export default function DeliveryPage() {
  const { authStatus, currentUser } = useAuth()

  useEffect(() => {
    trackPageView("/delivery")
  }, [])

  useEffect(() => {
    console.log("[delivery page] currentUser:", currentUser)
  }, [currentUser])

  if (authStatus === "loading") return <LoadingScreen />

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold text-white">🚚 대체배송</h1>
          <div className="ml-auto">
            <RatingDisplay email={currentUser?.email || ""} />
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-4">
        <DeliveryBoard
          currentEmail={currentUser?.email}
          branchId={currentUser?.branchId ?? null}
        />
      </section>
    </main>
  )
}
