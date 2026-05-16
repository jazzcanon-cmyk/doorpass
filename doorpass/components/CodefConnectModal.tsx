"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CARD_ORGS } from "@/lib/codef"

function localDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function getDefaultStart() { const d = new Date(); d.setMonth(d.getMonth() - 1); return localDateStr(d) }
function getDefaultEnd() { return localDateStr(new Date()) }

type Step = "select-type" | "select-card" | "credentials" | "connecting" | "select-date" | "importing" | "done" | "kakao-phone" | "kakao-waiting"

interface Props { open: boolean; userId: number; onClose: () => void; onImported?: (count: number) => void }

export function CodefConnectModal({ open, userId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("select-type")
  const [serviceKind, setServiceKind] = useState<"hometax" | "card">("hometax")
  const [cardOrgCode, setCardOrgCode] = useState("")
  const [loginId, setLoginId] = useState("")
  const [loginPw, setLoginPw] = useState("")
  const [startDate, setStartDate] = useState(() => getDefaultStart())
  const [endDate, setEndDate] = useState(() => getDefaultEnd())
  const [error, setError] = useState("")
  const [resultMsg, setResultMsg] = useState("")
  const [savedCount, setSavedCount] = useState(0)
  const [phoneNo, setPhoneNo] = useState("")
  const [userName, setUserName] = useState("")
  const [identity, setIdentity] = useState("")
  const [kakaoJobId, setKakaoJobId] = useState("")
  const [kakaoExtraInfo, setKakaoExtraInfo] = useState<unknown>(null)
  const [pollCount, setPollCount] = useState(0)

  function handleClose() {
    setStep("select-type"); setServiceKind("hometax"); setCardOrgCode("")
    setLoginId(""); setLoginPw(""); setError(""); setResultMsg(""); setSavedCount(0)
    setPhoneNo(""); setUserName(""); setIdentity(""); setKakaoJobId(""); setKakaoExtraInfo(null); setPollCount(0)
    onClose()
  }

  function getServiceType() { return serviceKind === "hometax" ? "hometax" : `card_${cardOrgCode}` }
  function getCardName() { return CARD_ORGS.find((c) => c.code === cardOrgCode)?.name ?? cardOrgCode }

  async function handleConnect() {
    if (!loginId || !loginPw) { setError("아이디와 비밀번호를 입력해주세요."); return }
    setError(""); setStep("connecting")
    try {
      const res = await fetch("/api/codef/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, serviceType: getServiceType(), organization: serviceKind === "hometax" ? "0001" : cardOrgCode, loginId, loginPassword: loginPw }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? "연결 실패"); setStep("credentials"); return }
      setStep("select-date")
    } catch { setError("서버 오류가 발생했습니다."); setStep("credentials") }
  }

  async function handleImport() {
    setError(""); setStep("importing")
    try {
      const endpoint = serviceKind === "hometax" ? "/api/codef/hometax" : "/api/codef/card"
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, serviceType: getServiceType(), startDate: startDate.replace(/-/g, ""), endDate: endDate.replace(/-/g, "") }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? "가져오기 실패"); setStep("select-date"); return }
      setSavedCount(data.saved ?? 0); setResultMsg(data.message ?? "완료"); setStep("done")
      onImported?.(data.saved ?? 0)
    } catch { setError("서버 오류가 발생했습니다."); setStep("select-date") }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent showCloseButton={false} className="bg-slate-900 border-white/10 text-white w-[92vw] max-w-sm mx-auto p-0 rounded-2xl">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-5 pt-4 pb-3 rounded-t-2xl flex-shrink-0">
          <button onClick={handleClose} className="absolute top-3 right-3 z-20 text-white/60 hover:text-white bg-black/20 rounded-full p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <DialogTitle className="text-lg font-bold text-white">🔗 자동 내역 가져오기</DialogTitle>
          <DialogDescription className="text-blue-100 text-sm mt-0.5">홈택스·카드사 연결 → 지출 자동 수집</DialogDescription>
        </div>
        <div className="px-5 py-4 space-y-4">

          {step === "select-type" && (
            <>
              <p className="text-sm text-white/70">어떤 서비스를 연결할까요?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setServiceKind("hometax"); setStep("credentials") }} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-center transition-all active:scale-95">
                  <div className="text-3xl mb-1">🏛️</div><div className="text-sm font-bold">홈택스</div><div className="text-xs text-white/50 mt-0.5">현금영수증 자동수집</div>
                </button>
                <button onClick={() => { setServiceKind("card"); setStep("select-card") }} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-center transition-all active:scale-95">
                  <div className="text-3xl mb-1">💳</div><div className="text-sm font-bold">카드사</div><div className="text-xs text-white/50 mt-0.5">카드내역 자동수집</div>
                </button>
                <button
                  onClick={() => { setServiceKind("hometax"); setStep("kakao-phone") }}
                  className="col-span-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded-xl p-3 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span className="text-xl">🟡</span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-yellow-300">카카오 간편인증</div>
                    <div className="text-xs text-white/50">비밀번호 없이 카카오톡으로 홈택스 연결</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {step === "select-card" && (
            <>
              <button onClick={() => setStep("select-type")} className="text-xs text-white/50 hover:text-white">← 뒤로</button>
              <p className="text-sm text-white/70">카드사를 선택하세요</p>
              <div className="grid grid-cols-2 gap-2">
                {CARD_ORGS.map((c) => (
                  <button key={c.code} onClick={() => { setCardOrgCode(c.code); setStep("credentials") }} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-left transition-all active:scale-95">
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "credentials" && (
            <>
              <button onClick={() => setStep(serviceKind === "hometax" ? "select-type" : "select-card")} className="text-xs text-white/50 hover:text-white">← 뒤로</button>
              <p className="text-sm text-white/70"><span className="text-white font-bold">{serviceKind === "hometax" ? "🏛️ 홈택스" : `💳 ${getCardName()}`}</span> 로그인 정보를 입력하세요</p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-300">🔒 비밀번호는 RSA로 암호화 후 CODEF 서버로 전송됩니다. 당사 서버에는 저장되지 않습니다.</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void handleConnect() }} className="space-y-2.5">
                <input type="text" placeholder={serviceKind === "hometax" ? "홈택스 아이디" : "카드 웹사이트 아이디"} value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400"/>
                <input type="password" placeholder="비밀번호" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400"/>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={!loginId || !loginPw} className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl">연결하기 🔗</Button>
              </form>
            </>
          )}

          {step === "kakao-phone" && (
            <>
              <button onClick={() => setStep("select-type")} className="text-xs text-white/50 hover:text-white">← 뒤로</button>
              <p className="text-sm text-white/70">홈택스에 등록된 <span className="text-white font-bold">전화번호</span>를 입력하세요</p>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-300">🔒 입력 정보는 RSA로 암호화 후 CODEF 서버로 전송됩니다. 당사 서버에는 저장되지 않습니다.</p>
              </div>
              <input
                type="tel"
                placeholder="010-1234-5678"
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
              />
              <input
                type="text"
                placeholder="이름 (홈택스 등록 이름)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
              />
              <input
                type="text"
                placeholder="주민번호 앞 7자리 (예: 8001011)"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                maxLength={7}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                onClick={async () => {
                  if (!phoneNo || !userName || !identity) { setError("모든 항목을 입력해주세요."); return }
                  setError("")
                  setStep("connecting")
                  try {
                    const res = await fetch("/api/codef/kakao/start", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phoneNo, userName, identity }),
                    })
                    const data = await res.json()
                    if (!data.success) { setError(data.message ?? "인증 요청 실패"); setStep("kakao-phone"); return }
                    if (data.completed) { setStep("select-date"); return }
                    setKakaoJobId(data.jobId)
                    setKakaoExtraInfo(data.extraInfo)
                    setPollCount(0)
                    setStep("kakao-waiting")
                  } catch { setError("서버 오류가 발생했습니다."); setStep("kakao-phone") }
                }}
                disabled={!phoneNo || !userName || !identity}
                className="w-full h-12 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-900 font-bold rounded-xl"
              >
                🟡 카카오톡으로 인증 요청
              </Button>
            </>
          )}

          {step === "kakao-waiting" && (
            <div className="text-center py-4 space-y-4">
              <div className="text-5xl animate-bounce">🟡</div>
              <p className="font-bold text-yellow-300 text-lg">카카오톡 확인해주세요!</p>
              <p className="text-sm text-white/60">카카오톡 앱에서 인증 요청을 승인하면<br/>자동으로 연결됩니다</p>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40">확인 중... ({pollCount}회)</p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                onClick={async () => {
                  setPollCount(p => p + 1)
                  setError("")
                  try {
                    const res = await fetch("/api/codef/kakao/confirm", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId, phoneNo, userName, identity, jobId: kakaoJobId, extraInfo: kakaoExtraInfo }),
                    })
                    const data = await res.json()
                    if (!data.success) { setError(data.message ?? "확인 실패"); return }
                    if (data.completed) { setStep("select-date") }
                    else { setError("아직 승인 전입니다. 카카오톡을 확인해주세요.") }
                  } catch { setError("서버 오류가 발생했습니다.") }
                }}
                className="w-full h-12 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-bold rounded-xl"
              >
                ✅ 카카오톡 승인했어요
              </Button>
              <button onClick={() => setStep("kakao-phone")} className="text-xs text-white/40 hover:text-white">← 다시 시도</button>
            </div>
          )}

          {step === "connecting" && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3 animate-pulse">🔗</div>
              <p className="text-sm text-white/70">계정 연결 중입니다...</p>
              <p className="text-xs text-white/40 mt-1">잠시만 기다려주세요</p>
            </div>
          )}

          {step === "select-date" && (
            <>
              <div className="text-center pb-1"><div className="text-3xl mb-1">✅</div><p className="text-green-400 font-bold text-sm">연결 완료!</p></div>
              <p className="text-sm text-white/70">가져올 기간을 선택하세요</p>
              <div className="space-y-2.5">
                <div><label className="text-xs text-white/50 mb-1 block">시작일</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400"/></div>
                <div><label className="text-xs text-white/50 mb-1 block">종료일</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400"/></div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={() => void handleImport()} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl">📥 내역 가져오기</Button>
            </>
          )}

          {step === "importing" && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3 animate-bounce">📥</div>
              <p className="text-sm text-white/70">내역을 가져오는 중입니다...</p>
              <p className="text-xs text-white/40 mt-1">데이터 양에 따라 시간이 걸릴 수 있어요</p>
            </div>
          )}

          {step === "done" && (
            <>
              <div className="text-center py-3">
                <div className="text-5xl mb-2">🎉</div>
                <p className="text-2xl font-extrabold text-amber-400">{savedCount}건</p>
                <p className="text-sm text-white/70 mt-1">지출 내역에 저장됐어요!</p>
                <p className="text-xs text-white/40 mt-1">{resultMsg}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">💡 자동 수집 내역은 부가세공제 여부가 미확정입니다. 영수증 업로드로 정확하게 처리하세요.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setStep("select-type"); setError(""); setSavedCount(0) }} className="flex-1 h-11 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm">다른 계정 연결</Button>
                <Button onClick={handleClose} className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-sm">닫기</Button>
              </div>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
