"use client"

import Link from "next/link"
import { ArrowLeft, Shield, AlertTriangle, Eye, UserX, Scale } from "lucide-react"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-bold">이용약관</h1>
          <span className="ml-auto text-xs text-white/30">v1.0 · 2026.04.30 시행</span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">

        {/* 서비스 목적 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Shield className="h-5 w-5" />
            <h2 className="text-base font-bold text-white">제1조 서비스 목적</h2>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            DoorPass(이하 "본 서비스")는 CJ대한통운 배달·택배 기사의 업무 효율 향상을 위한
            공동현관 비밀번호 공유 및 관리 서비스입니다.
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            본 서비스는 배달·택배 기사의 신속한 배송 업무를 지원하기 위해 운영되며,
            해당 목적 이외의 용도로 사용될 수 없습니다.
          </p>
        </section>

        {/* 사용 제한 */}
        <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-6 space-y-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-bold text-white">제2조 사용 제한 (중요)</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2 text-white/80">
              <span className="text-red-400 font-bold shrink-0 mt-0.5">①</span>
              비밀번호 정보는 <span className="text-white font-semibold">배송 업무 목적으로만</span> 사용해야 합니다.
            </li>
            <li className="flex items-start gap-2 text-white/80">
              <span className="text-red-400 font-bold shrink-0 mt-0.5">②</span>
              수집된 비밀번호 정보를 <span className="text-white font-semibold">제3자에게 공유하거나 유포하는 행위</span>는 엄격히 금지됩니다.
            </li>
            <li className="flex items-start gap-2 text-white/80">
              <span className="text-red-400 font-bold shrink-0 mt-0.5">③</span>
              개인적 용도(개인 거주, 방문 등) 또는 <span className="text-white font-semibold">배송 외 목적</span>의 사용은 금지됩니다.
            </li>
            <li className="flex items-start gap-2 text-white/80">
              <span className="text-red-400 font-bold shrink-0 mt-0.5">④</span>
              본 약관을 위반하여 발생하는 <span className="text-white font-semibold">모든 민·형사상 책임은 사용자 본인</span>에게 있습니다.
            </li>
            <li className="flex items-start gap-2 text-white/80">
              <span className="text-red-400 font-bold shrink-0 mt-0.5">⑤</span>
              운영자(DoorPass)는 사용자의 약관 위반으로 인한 <span className="text-white font-semibold">어떠한 법적 책임도 지지 않습니다.</span>
            </li>
          </ul>
        </section>

        {/* 개인정보 수집 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <Eye className="h-5 w-5" />
            <h2 className="text-base font-bold text-white">제3조 개인정보 수집 및 이용</h2>
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
              수집 항목: 이메일, 이름, 로그인 기록
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
              건물 조회 기록은 IP 주소와 함께 저장됩니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
              수집된 정보는 서비스 운영 및 남용 방지 목적으로만 사용됩니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
              데이터 보존 기간: 마지막 로그인으로부터 <span className="text-white font-medium">1년</span>
            </li>
          </ul>
        </section>

        {/* 계정 정지 및 해지 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
          <div className="flex items-center gap-2 text-orange-400">
            <UserX className="h-5 w-5" />
            <h2 className="text-base font-bold text-white">제4조 계정 정지 및 해지</h2>
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              약관 위반이 확인된 경우 <span className="text-white font-medium">사전 통보 없이 즉시 계정이 정지</span>될 수 있습니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              비정상적인 대량 조회 또는 자동화 접근 시 자동으로 차단될 수 있습니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-400 shrink-0 mt-0.5">•</span>
              계정 정지에 대한 이의 신청은 관리자에게 문의하시기 바랍니다.
            </li>
          </ul>
        </section>

        {/* 면책 조항 */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-3">
          <div className="flex items-center gap-2 text-purple-400">
            <Scale className="h-5 w-5" />
            <h2 className="text-base font-bold text-white">제5조 면책 조항</h2>
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 shrink-0 mt-0.5">•</span>
              사용자의 약관 위반으로 인해 발생한 손해에 대해 운영자는 책임을 지지 않습니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 shrink-0 mt-0.5">•</span>
              건물 비밀번호 변경으로 인한 배송 불편은 운영자의 책임이 아닙니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 shrink-0 mt-0.5">•</span>
              사용자가 등록한 비밀번호의 정확성에 대해 운영자는 보증하지 않습니다.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 shrink-0 mt-0.5">•</span>
              서비스 장애, 데이터 손실 등 불가항력적 상황에 대해 운영자는 책임을 지지 않습니다.
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-white/20 pb-4">
          본 약관은 2026년 4월 30일부터 시행됩니다.
        </p>
      </div>
    </main>
  )
}
