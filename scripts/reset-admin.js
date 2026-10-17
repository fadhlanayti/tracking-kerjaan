const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  })
  console.log('Daftar user di database:', users)

  if (users.length === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
      data: {
        email: 'mimin@weballcreative.com',
        name: 'WeballCreative Admin',
        password: hash,
        role: 'ADMIN',
        isActive: true,
      }
    })
    console.log('Berhasil membuat user admin baru:', admin.email)
    return
  }

  const target = users.find(u => u.role === 'ADMIN') || users[0]
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.update({
    where: { id: target.id },
    data: { password: hash }
  })
  console.log(`Password akun ${target.email} (${target.role}) direset ke: admin123`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
