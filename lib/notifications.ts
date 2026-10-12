import { prisma } from './prisma'
import { sendWhatsApp, normalizePhone } from './whatsapp'

export async function createNotification(data: {
  userId: string
  type: string
  title: string
  message: string
  referenceId?: string
  referenceType?: string
  waMessage?: string
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
    },
  })

  // Send WA notification if user has phone
  if (data.waMessage) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { phone: true },
    })

    if (user?.phone) {
      const sent = await sendWhatsApp(normalizePhone(user.phone), data.waMessage)
      if (sent) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { waSent: true },
        })
      }
    }
  }

  return notification
}
