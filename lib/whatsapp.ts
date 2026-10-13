const WA_API_URL = process.env.WA_API_URL!
const WA_API_KEY = process.env.WA_API_KEY!

/** Strip non-digits, handle 08→628, +62→62, bare number→62 prefix */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${WA_API_URL}/api/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WA_API_KEY,
      },
      body: JSON.stringify({ to, message }),
    })
    return res.ok
  } catch {
    console.error('WA send failed to', to)
    return false
  }
}

export function formatIssueAssigned(data: {
  projectName: string
  issueId: string
  issueTitle: string
  priority: string
  projectId: string
  appUrl: string
}): string {
  return `[WeballCreative] Kamu di-assign issue baru:
Proyek: ${data.projectName}
Issue: #${data.issueId} ${data.issueTitle}
Priority: ${data.priority}
Buka: ${data.appUrl}/projects/${data.projectId}/issues/${data.issueId}`
}

export function formatStatusChanged(data: {
  projectName: string
  issueId: string
  issueTitle: string
  oldStatus: string
  newStatus: string
  projectId: string
  appUrl: string
}): string {
  return `[WeballCreative] Update proyek kamu:
Proyek: ${data.projectName}
Issue: #${data.issueId} ${data.issueTitle}
Status: ${data.oldStatus} → ${data.newStatus}
Buka: ${data.appUrl}/projects/${data.projectId}/issues/${data.issueId}`
}

export function formatNewComment(data: {
  authorName: string
  issueId: string
  issueTitle: string
  commentPreview: string
  projectId: string
  appUrl: string
}): string {
  return `[WeballCreative] Comment baru dari ${data.authorName}:
Issue: #${data.issueId} ${data.issueTitle}
"${data.commentPreview}"
Buka: ${data.appUrl}/projects/${data.projectId}/issues/${data.issueId}`
}

export function formatTicketRevised(data: {
  creatorName: string
  projectName: string
  ticketTitle: string
  ticketType: string
  projectId: string
  appUrl: string
}): string {
  const typeLabel: Record<string, string> = {
    DEPLOY: '🚀 Deploy',
    FEATURE: '✨ Fitur Baru',
    BUGFIX: '🐛 Bugfix',
    OTHER: '📋 Lainnya',
  }
  return `[WeballCreative] Ticket telah direvisi oleh developer:
Proyek: ${data.projectName}
Oleh: ${data.creatorName}
Tipe: ${typeLabel[data.ticketType] || data.ticketType}
Judul: "${data.ticketTitle}"
Status: Menunggu Review Ulang PM
Buka: ${data.appUrl}/projects/${data.projectId}/tickets`
}

export function formatTicketNew(data: {
  creatorName: string
  projectName: string
  ticketTitle: string
  ticketType: string
  projectId: string
  appUrl: string
}): string {
  const typeLabel: Record<string, string> = {
    DEPLOY: '🚀 Deploy',
    FEATURE: '✨ Fitur Baru',
    BUGFIX: '🐛 Bugfix',
    OTHER: '📋 Lainnya',
  }
  return `[WeballCreative] Ticket baru perlu review PM:\nProyek: ${data.projectName}\nDari: ${data.creatorName}\nTipe: ${typeLabel[data.ticketType] || data.ticketType}\nJudul: "${data.ticketTitle}"\nBuka: ${data.appUrl}/projects/${data.projectId}/tickets`
}

export function formatTicketStatus(data: {
  status: string
  ticketTitle: string
  projectName: string
  pmNotes?: string | null
  projectId: string
  appUrl: string
}): string {
  const statusLabel: Record<string, string> = {
    APPROVED: '✅ Disetujui',
    REJECTED: '❌ Ditolak',
    REVISION: '✏️ Perlu Revisi',
  }
  const label = statusLabel[data.status] || data.status
  const notes = data.pmNotes ? `\nCatatan: ${data.pmNotes}` : ''
  return `[WeballCreative] Update ticket kamu:\nProyek: ${data.projectName}\nTicket: "${data.ticketTitle}"\nStatus: ${label}${notes}\nBuka: ${data.appUrl}/projects/${data.projectId}/tickets`
}

export function formatProjectUpdate(data: {
  projectName: string
  title: string
  authorName: string
  status: string
  projectId: string
  appUrl: string
}): string {
  const statusLabels: Record<string, string> = {
    DO: '📝 Backlog (DO)',
    DOING: '⚡ Sedang Dikerjakan (DOING)',
    DONE: '✅ Selesai (DONE)',
  }
  const label = statusLabels[data.status] || data.status
  return `[WeballCreative] Progress baru pada proyek ${data.projectName}:
Fitur/Update: "${data.title}"
Oleh: ${data.authorName}
Status: ${label}
Buka detail proyek: ${data.appUrl}/projects/${data.projectId}`
}

export function formatInvite(inviteUrl: string): string {
  return `[WeballCreative] Kamu diundang ke platform project management kami.
Klik link berikut untuk bergabung:
${inviteUrl}
Link berlaku 48 jam.`
}
