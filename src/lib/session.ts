import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { company: true } });
  if (!user?.active) redirect('/login');
  return user;
}
