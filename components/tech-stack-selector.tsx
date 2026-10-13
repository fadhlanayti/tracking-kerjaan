"use client"

import * as React from "react"
import {
  SiNextdotjs,
  SiReact,
  SiTypescript,
  SiJavascript,
  SiTailwindcss,
  SiFramer,
  SiVuedotjs,
  SiNodedotjs,
  SiExpress,
  SiLaravel,
  SiGo,
  SiPython,
  SiFastapi,
  SiFlutter,
  SiPostgresql,
  SiMysql,
  SiPrisma,
  SiDocker,
  SiSupabase,
  SiFirebase,
  SiMongodb,
  SiRedis
} from "react-icons/si"
import { Check, X } from "lucide-react"

export interface TechItem {
  name: string
  aliases?: string[]
  icon: React.ReactNode
  accent: string
  category: "Frontend" | "Backend" | "Mobile" | "Database/Tools"
}

export const PRESET_TECHS: TechItem[] = [
  { name: "Next.js", aliases: ["nextjs", "next"], icon: <SiNextdotjs size={14} />, accent: "#000000", category: "Frontend" },
  { name: "React", aliases: ["reactjs"], icon: <SiReact size={14} />, accent: "#149ECA", category: "Frontend" },
  { name: "TypeScript", aliases: ["ts", "typescript"], icon: <SiTypescript size={14} />, accent: "#3178C6", category: "Frontend" },
  { name: "JavaScript", aliases: ["js", "javascript"], icon: <SiJavascript size={14} />, accent: "#F7DF1E", category: "Frontend" },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"], icon: <SiTailwindcss size={14} />, accent: "#06B6D4", category: "Frontend" },
  { name: "Framer Motion", aliases: ["framer", "framermotion"], icon: <SiFramer size={14} />, accent: "#0055FF", category: "Frontend" },
  { name: "Vue.js", aliases: ["vue", "vuejs"], icon: <SiVuedotjs size={14} />, accent: "#4FC08D", category: "Frontend" },
  { name: "Node.js", aliases: ["nodejs", "node"], icon: <SiNodedotjs size={14} />, accent: "#5FA04E", category: "Backend" },
  { name: "Express", aliases: ["express.js", "expressjs", "express."], icon: <SiExpress size={14} />, accent: "#000000", category: "Backend" },
  { name: "Laravel", aliases: ["laravel"], icon: <SiLaravel size={14} />, accent: "#FF2D20", category: "Backend" },
  { name: "Golang", aliases: ["go", "golang"], icon: <SiGo size={14} />, accent: "#00ADD8", category: "Backend" },
  { name: "Python", aliases: ["python", "py"], icon: <SiPython size={14} />, accent: "#3776AB", category: "Backend" },
  { name: "FastAPI", aliases: ["fastapi"], icon: <SiFastapi size={14} />, accent: "#009688", category: "Backend" },
  { name: "Flutter", aliases: ["flutter"], icon: <SiFlutter size={14} />, accent: "#02569B", category: "Mobile" },
  { name: "React Native", aliases: ["reactnative"], icon: <SiReact size={14} />, accent: "#61DAFB", category: "Mobile" },
  { name: "PostgreSQL", aliases: ["postgres", "postgresql"], icon: <SiPostgresql size={14} />, accent: "#4169E1", category: "Database/Tools" },
  { name: "MySQL", aliases: ["mysql"], icon: <SiMysql size={14} />, accent: "#4479A1", category: "Database/Tools" },
  { name: "MongoDB", aliases: ["mongo", "mongodb"], icon: <SiMongodb size={14} />, accent: "#47A248", category: "Database/Tools" },
  { name: "Redis", aliases: ["redis"], icon: <SiRedis size={14} />, accent: "#DC382D", category: "Database/Tools" },
  { name: "Prisma", aliases: ["prisma"], icon: <SiPrisma size={14} />, accent: "#2D3748", category: "Database/Tools" },
  { name: "Docker", aliases: ["docker"], icon: <SiDocker size={14} />, accent: "#2496ED", category: "Database/Tools" },
  { name: "Supabase", aliases: ["supabase"], icon: <SiSupabase size={14} />, accent: "#3ECF8E", category: "Database/Tools" },
  { name: "Firebase", aliases: ["firebase"], icon: <SiFirebase size={14} />, accent: "#FFCA28", category: "Database/Tools" },
]

export function findTechPreset(name: string): TechItem | undefined {
  const clean = name.trim().toLowerCase().replace(/\.+$/, "")
  return PRESET_TECHS.find(p => {
    if (p.name.toLowerCase() === clean) return true
    if (p.aliases?.some(a => a.toLowerCase() === clean)) return true
    return false
  })
}

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
            const preset = findTechPreset(item)
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-zinc-900 border border-zinc-200 shadow-2xs"
              >
                {preset ? (
                  <span style={{ color: preset.accent }} className="flex items-center shrink-0">
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
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
        {PRESET_TECHS.map(tech => {
          const isSelected = selectedList.some(s => s.toLowerCase() === tech.name.toLowerCase() || tech.aliases?.includes(s.toLowerCase()))
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
