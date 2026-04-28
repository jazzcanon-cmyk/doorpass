"use client"

interface TabBtnProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

export function TabBtn({ active, onClick, children }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

interface SmallToggleProps {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}

export function SmallToggle({ options, value, onChange }: SmallToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-0.5 text-[11px] w-fit">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2 py-0.5 rounded-md transition-all ${
            value === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
