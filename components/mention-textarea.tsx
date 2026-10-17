'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface MentionUser {
  id: string
  name: string
  avatar?: string | null
  role?: string
}

interface Props {
  value: string
  onChange: (val: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  members: MentionUser[]
  placeholder?: string
  rows?: number
  className?: string
  style?: React.CSSProperties
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function MentionTextarea({
  value, onChange, onKeyDown, members, placeholder, rows = 1, className, style, inputRef,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [query, setQuery] = useState('')
  const [filtered, setFiltered] = useState<MentionUser[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const localRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const textareaEl = inputRef || localRef

  const updateMentionState = useCallback((text: string, cursorPos: number) => {
    // Cari '@' terakhir sebelum cursor yang belum ditutup spasi
    const before = text.slice(0, cursorPos)
    const atIdx = before.lastIndexOf('@')
    if (atIdx === -1) { setShowDropdown(false); return }

    // @ harus di awal atau setelah spasi/newline
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) { setShowDropdown(false); return }

    const q = before.slice(atIdx + 1)
    // Jika sudah ada spasi setelah query > 15 char, tutup
    if (q.length > 20) { setShowDropdown(false); return }

    setQuery(q)
    setMentionStart(atIdx)
    const lower = q.toLowerCase()
    const matches = q.length === 0 ? members : members.filter(m => m.name.toLowerCase().includes(lower))
    setFiltered(matches.slice(0, 6))
    setShowDropdown(matches.length > 0)
    setSelectedIdx(0)
  }, [members])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal = e.target.value
    onChange(newVal)
    const cursor = e.target.selectionStart
    updateMentionState(newVal, cursor)
  }

  function insertMention(user: MentionUser) {
    const el = textareaEl.current
    if (!el || mentionStart === -1) return
    const before = value.slice(0, mentionStart)
    const after = value.slice(el.selectionStart)
    const inserted = `${before}@${user.name} ${after}`
    onChange(inserted)
    setShowDropdown(false)

    // Set cursor after inserted name
    requestAnimationFrame(() => {
      const pos = mentionStart + user.name.length + 2 // @name + space
      el.setSelectionRange(pos, pos)
      el.focus()
    })
  }

  function handleKeyDownInternal(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIdx]) {
          e.preventDefault()
          insertMention(filtered[selectedIdx])
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowDropdown(false)
        return
      }
    }
    onKeyDown?.(e)
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Scroll selected item into view
  useEffect(() => {
    if (!showDropdown) return
    const el = dropdownRef.current?.children[selectedIdx] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx, showDropdown])

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaEl}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        rows={rows}
        className={className}
        style={style}
      />

      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 bottom-full mb-1 w-full max-w-72 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map((user, i) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertMention(user) }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left text-sm border-none cursor-pointer transition-colors ${
                  i === selectedIdx ? 'bg-zinc-100' : 'bg-transparent hover:bg-zinc-50'
                }`}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-300 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{user.name}</div>
                  {user.role && <div className="text-[10px] text-zinc-400">{user.role}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
