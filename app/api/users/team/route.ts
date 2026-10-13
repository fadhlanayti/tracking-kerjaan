import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ambil user internal / tim (ADMIN & DEVELOPER) yang aktif
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'DEVELOPER'] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      position: true,
      avatar: true,
      linkedin: true,
      github: true,
      phone: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const members = users.map((u) => {
    // Foto profil user atau fallback Unsplash
    const image =
      u.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

    return {
      id: u.id,
      name: u.name,
      role: u.position || (u.role === 'ADMIN' ? 'Head of Tech & PM' : 'Web Developer'),
      image,
      social: {
        linkedin: u.linkedin || undefined,
        github: u.github || undefined,
      },
    };
  });

  return NextResponse.json(members);
}
