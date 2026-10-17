import { prisma } from './prisma'
import { createNotification } from './notifications'

/**
 * Parse @mention dalam teks, cari user di project, kirim notifikasi + WA.
 * Format mention: @nama (case-insensitive, name matching)
 */
export async function notifyMentions(opts: {
  content: string
  projectId: string
  authorId: string          // user yang nulis (tidak di-notify)
  refType: 'chat' | 'issue_comment' | 'ticket_comment' | 'update_log'
  refId: string             // messageId / commentId / ticketId / updateId
  refTitle?: string         // judul issue/ticket/update untuk konteks WA
  refUrl: string            // URL langsung ke konten
  authorName: string
}) {
  const { content, projectId, authorId, refType, refId, refTitle, refUrl, authorName } = opts

  // Extract @mentions — kata setelah @ sampai spasi/punctuation
  const raw = content.match(/@([\w\s]+?)(?=\s@|\s|$|[.,!?])/g)
  if (!raw || raw.length === 0) return

  const mentionNames = [...new Set(raw.map(m => m.slice(1).trim().toLowerCase()))]

  // Ambil semua member project
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, phone: true } } },
  })

  // Tambah admin global
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, phone: true },
  })

  const allUsers = [
    ...members.map(m => m.user),
    ...admins,
  ]

  // Match nama — fuzzy: jika mention adalah substring dari nama user
  const mentionedUsers = allUsers.filter(u =>
    u.id !== authorId &&
    mentionNames.some(m => u.name.toLowerCase().includes(m) || m.includes(u.name.toLowerCase().split(' ')[0]))
  )

  const typeLabel: Record<string, string> = {
    chat: '💬 Project Chat',
    issue_comment: '🐛 Issue Comment',
    ticket_comment: '🎫 Ticket Update',
    update_log: '📋 Progress Update',
  }

  const seen = new Set<string>()
  for (const user of mentionedUsers) {
    if (seen.has(user.id)) continue
    seen.add(user.id)

    const preview = content.length > 100 ? content.slice(0, 100) + '…' : content
    const waMsg = `[WeballCreative] Kamu di-tag oleh ${authorName} di ${typeLabel[refType] || refType}:${refTitle ? `\n${refTitle}` : ''}\n"${preview}"\nBuka: ${refUrl}`

    await createNotification({
      userId: user.id,
      type: 'MENTION',
      title: `${authorName} mention kamu`,
      message: `${authorName} mention kamu di ${typeLabel[refType]}: "${preview}"`,
      referenceId: refId,
      referenceType: refType,
      waMessage: waMsg,
    })
  }
}
