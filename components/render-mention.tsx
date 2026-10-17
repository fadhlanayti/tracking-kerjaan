'use client'

/**
 * Render text dengan @mention di-bold.
 * "@Nama User" → <strong>@Nama User</strong>
 */
export function RenderMention({ text, className }: { text: string; className?: string }) {
  // Split on @mention pattern: @word(s) sampai double-space, newline, atau end
  const parts = text.split(/(@[\w][\w\s]*?)(?=\s{2}|\n|$|[.,!?](?:\s|$))/g)

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <strong key={i} className="font-bold text-blue-600">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}
