"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PasswordAccess } from "@/types/building"

const MASK = "●●●●"

export function BuildingPasswordDisplay({
  access,
  password,
  variant = "compact",
  className,
}: {
  access: PasswordAccess
  password: string
  variant?: "compact" | "panel"
  className?: string
}) {
  if (access === "full") {
    return (
      <span
        className={cn(
          "font-mono font-bold text-yellow-400",
          variant === "panel" ? "text-lg" : "text-base whitespace-nowrap",
          className
        )}
      >
        {password ? password : <span className="text-muted-foreground italic font-sans font-normal text-sm">미입력</span>}
      </span>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        variant === "compact" ? "items-end text-right" : "items-start",
        className
      )}
    >
      <span
        className={cn(
          "font-mono font-bold text-yellow-400/90 tracking-tight",
          variant === "panel" ? "text-lg" : "text-base whitespace-nowrap"
        )}
      >
        {MASK}
      </span>
      {access === "checking" ? null : access === "masked_user" ? (
        <>
          <span className="text-[10px] leading-tight text-muted-foreground">승인 후 열람 가능</span>
          <Button asChild size="sm" variant="secondary" className="h-7 px-2.5 text-[11px]">
            <Link href="/select-branch">승인 요청하기</Link>
          </Button>
        </>
      ) : (
        <span className="text-[10px] leading-tight text-muted-foreground">로그인 후 승인 요청 가능</span>
      )}
    </div>
  )
}
