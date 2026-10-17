'use client'

/**
 * Render text dengan @mention di-bold.
 * Deteksi berdasarkan nama member yang dikenal — bukan regex generic.
 * Jika tidak ada members list, fallback ke pattern @Nama sampai spasi ganda/newline.
 */
export function RenderMention({
  text,
  className,
  members = [],
}: {
  text: string
  className?: string
  members?: { name: string }[]
}) {
  if (!text) return <span className={className} />

  // Bangun regex dari nama member — sort panjang terbesar dulu agar "Mba Anis Nalala" match sebelum "Mba"
  const names = members
    .map(m => m.name)
    .filter(n => n.length > 0)
    .sort((a, b) => b.length - a.length)

  let regex: RegExp
  if (names.length > 0) {
    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    regex = new RegExp(`@(${escaped.join('|')})`, 'gi')
  } else {
    // Fallback: @word
    regex = /@([\w]+)/g
  }

  const result: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    result.push(
      <strong key={`m${match.index}`} className="font-semibold text-blue-600">
        @{match[1]}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return <span className={className}>{result.length > 0 ? result : text}</span>
}
