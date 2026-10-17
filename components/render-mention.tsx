'use client'

/**
 * Render text dengan @mention di-bold.
 * Mention = @Nama yang di-insert via MentionTextarea (diakhiri spasi atau end)
 */
export function RenderMention({ text, className }: { text: string; className?: string }) {
  // Match @mention: @ diikuti nama (huruf, angka, spasi) yang diinsert dari dropdown
  // Nama pasti diakhiri spasi (karena insertMention menambah spasi setelah nama)
  // Pattern: @, lalu 1-40 karakter word/spasi, stop di spasi-ganda, newline, punctuation, atau akhir string
  const regex = /@([\w][\w ]{0,38}?)(?= |$|\n|[.,!?;:])/g

  const result: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Teks sebelum mention
    if (match.index > lastIndex) {
      result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    // Mention itself
    result.push(
      <strong key={`m${match.index}`} className="font-semibold text-blue-600">
        @{match[1]}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }

  // Sisa teks setelah mention terakhir
  if (lastIndex < text.length) {
    result.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return <span className={className}>{result.length > 0 ? result : text}</span>
}
