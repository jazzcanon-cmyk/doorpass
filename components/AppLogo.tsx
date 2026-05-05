interface AppLogoProps {
  size?: "sm" | "lg"
}

export function AppLogo({ size = "sm" }: AppLogoProps) {
  const isLarge = size === "lg"
  const boxClass = isLarge
    ? "h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30"
    : "relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex-shrink-0"
  const svgClass = isLarge ? "h-8 w-8 text-white" : "relative h-[18px] w-[18px] text-white"
  const stroke = isLarge ? "2" : "2.5"

  return (
    <div className={boxClass}>
      {!isLarge && (
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-blue-400/40 to-indigo-500/40 blur opacity-60" />
      )}
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9v.01" />
        <path d="M9 12v.01" />
        <path d="M9 15v.01" />
        <path d="M9 18v.01" />
      </svg>
    </div>
  )
}
