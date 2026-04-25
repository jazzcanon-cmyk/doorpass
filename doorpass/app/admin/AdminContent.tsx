"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface User {
    id: number
    kakao_id: string | null
    name: string
    phone: string | null
    role: string
    is_active: boolean
}

export function AdminContent() {
    const [users, setUsers] = useState<User[]>([])
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")

    const load = async () => {
        const { data } = await supabase
            .from("approved_users")
            .select("*")
            .order("created_at")
        if (data) setUsers(data)
    }

    useEffect(() => { load() }, [])

    const add = async () => {
        if (!name.trim()) { toast.error("이름을 입력해주세요."); return }
        await supabase.from("approved_users").insert({
            name: name.trim(),
            phone: phone.trim() || null,
            role: "driver"
        })
        toast.success("기사님이 추가되었습니다.")
        setName(""); setPhone(""); load()
    }

    const toggle = async (id: number, active: boolean) => {
        await supabase.from("approved_users").update({ is_active: !active }).eq("id", id)
        load()
    }

    const del = async (id: number, n: string) => {
        if (!confirm(n + "님을 삭제하시겠어요?")) return
        await supabase.from("approved_users").delete().eq("id", id)
        load()
    }

    return (
        <div style={{ maxWidth:480, margin:"0 auto", padding:20 }}>
            <h1 style={{ fontSize:18, fontWeight:700, marginBottom:20 }}>🚚 기사님 승인 관리</h1>

            <div style={{ background:"#eff6ff", borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#1d4ed8", lineHeight:1.6 }}>
                📋 기사님이 카카오 로그인하면 자동으로 연결돼요. 미리 이름을 등록해두세요!
            </div>

            <div style={{ background:"#f8fafc", borderRadius:16, padding:16, marginBottom:24, border:"1px solid #e2e8f0" }}>
                <p style={{ fontWeight:600, fontSize:14, margin:"0 0 12px" }}>+ 기사님 추가</p>
                <input
                    placeholder="이름 (필수)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, marginBottom:8, boxSizing:"border-box" }}
                />
                <input
                    placeholder="전화번호 (선택)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, marginBottom:12, boxSizing:"border-box" }}
                />
                <button
                    onClick={add}
                    style={{ width:"100%", background:"#2563eb", color:"white", fontWeight:600, fontSize:14, padding:"11px 0", borderRadius:8, border:"none", cursor:"pointer" }}
                >
                    추가하기
                </button>
            </div>

            <p style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>등록 인원 {users.length}명</p>

            {users.map(u => (
                <div key={u.id} style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12, opacity:u.is_active?1:0.5 }}>
                    <div style={{ fontSize:24 }}>{u.role === "admin" ? "👑" : "🚚"}</div>
                    <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>
                            {u.name}
                            {!u.kakao_id && u.role !== "admin" && (
                                <span style={{ fontSize:10, color:"#94a3b8", background:"#f1f5f9", padding:"2px 6px", borderRadius:99, marginLeft:6 }}>미연결</span>
                            )}
                        </div>
                        {u.phone && <div style={{ fontSize:12, color:"#94a3b8" }}>{u.phone}</div>}
                    </div>
                    {u.role !== "admin" && (
                        <div style={{ display:"flex", gap:6 }}>
                            <button
                                onClick={() => toggle(u.id, u.is_active)}
                                style={{ background:u.is_active?"#fef2f2":"#f0fdf4", color:u.is_active?"#dc2626":"#16a34a", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}
                            >
                                {u.is_active ? "차단" : "승인"}
                            </button>
                            <button
                                onClick={() => del(u.id, u.name)}
                                style={{ background:"#fef2f2", color:"#dc2626", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}
                            >
                                🗑
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
