"use client"

import * as React from "react"
import {
  Atom,
  Braces,
  Waves,
  Sparkles,
  Grid3X3,
  AppWindow,
  Wind,
  Blocks,
  Feather,
  Zap,
  Activity,
  Box,
  Orbit,
  CirclePlay,
  Cpu,
  Check,
  X
} from "lucide-react"

export interface TechItem {
  name: string
  icon: React.ReactNode
  accent: string
  category: "Frontend" | "Backend" | "Mobile" | "Database/Tools"
}

export const PRESET_TECHS: TechItem[] = [
  { name: "Next.js", icon: <AppWindow size={14} />, accent: "#18181B", category: "Frontend" },
  { name: "React", icon: <Atom size={14} />, accent: "#0284C7", category: "Frontend" },
  { name: "TypeScript", icon: <Braces size={14} />, accent: "#2563EB", category: "Frontend" },
  { name: "Tailwind CSS", icon: <Wind size={14} />, accent: "#06B6D4", category: "Frontend" },
  { name: "Framer Motion", icon: <Waves size={14} />, accent: "#8B5CF6", category: "Frontend" },
  { name: "Vue.js", icon: <Sparkles size={14} />, accent: "#10B981", category: "Frontend" },
  { name: "Node.js", icon: <Cpu size={14} />, accent: "#16A34A", category: "Backend" },
  { name: "Laravel", icon: <Zap size={14} />, accent: "#EF4444", category: "Backend" },
  { name: "Golang", icon: <Activity size={14} />, accent: "#00ADD8", category: "Backend" },
  { name: "Python / FastAPI", icon: <Box size={14} />, accent: "#F59E0B", category: "Backend" },
  { name: "Flutter", icon: <Orbit size={14} />, accent: "#0284C7", category: "Mobile" },
  { name: "React Native", icon: <Atom size={14} />, accent: "#6366F1", category: "Mobile" },
  { name: "PostgreSQL", icon: <Grid3X3 size={14} />, accent: "#336791", category: "Database/Tools" },
  { name: "MySQL", icon: <Blocks size={14} />, accent: "#F97316", category: "Database/Tools" },
  { name: "Prisma", icon: <Feather size={14} />, accent: "#10B981", category: "Database/Tools" },
  { name: "Docker", icon: <CirclePlay size={14} />, accent: "#0284C7", category: "Database/Tools" },
]

interface TechStackSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function TechStackSelector({ value, onChange }: TechStackSelectorProps) {
  const [customInput, setCustomInput] = React.useState("")

  const selectedList = React.useMemo(() => {
    if (!value) return []
    return value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  }, [value])

  function toggleTech(name: string) {
    if (selectedList.includes(name)) {
      const next = selectedList.filter(s => s !== name)
      onChange(next.join(", "))
    } else {
      const next = [...selectedList, name]
      onChange(next.join(", "))
    }
  }

  function addCustomTech() {
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (!selectedList.includes(trimmed)) {
      const next = [...selectedList, trimmed]
      onChange(next.join(", "))
    }
    setCustomInput("")
  }

  function removeTech(name: string) {
    const next = selectedList.filter(s => s !== name)
    onChange(next.join(", "))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Selected Items Tags */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-50 border border-zinc-200/80 rounded-xl min-h-[38px]">
          {selectedList.map(item => {
            const preset = PRESET_TECHS.find(p => p.name.toLowerCase() === item.toLowerCase())
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-zinc-900 border border-zinc-200 shadow-2xs"
              >
                {preset ? (
                  <span style={{ color: preset.accent }} className="flex items-center">
                    {preset.icon}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                )}
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => removeTech(item)}
                  className="text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer border-none bg-transparent p-0 flex items-center ml-0.5"
                  title={`Hapus ${item}`}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Preset Chips Quick Picker */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
        {PRESET_TECHS.map(tech => {
          const isSelected = selectedList.some(s => s.toLowerCase() === tech.name.toLowerCase())
          return (
            <button
              type="button"
              key={tech.name}
              onClick={() => toggleTech(tech.name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span
                style={{ color: isSelected ? "#FFFFFF" : tech.accent }}
                className="flex items-center shrink-0"
              >
                {tech.icon}
              </span>
              <span>{tech.name}</span>
              {isSelected && <Check size={11} className="text-white shrink-0 ml-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Custom Add Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault()
              addCustomTech()
            }
          }}
          placeholder="Ketik tech stack lain (e.g. Supabase, Redis)..."
          className="input text-xs !py-1.5 flex-1"
        />
        <button
          type="button"
          onClick={addCustomTech}
          disabled={!customInput.trim()}
          className="btn-secondary text-xs !py-1.5 !px-3 shrink-0 disabled:opacity-40"
        >
          + Tambah
        </button>
      </div>
    </div>
  )
}
