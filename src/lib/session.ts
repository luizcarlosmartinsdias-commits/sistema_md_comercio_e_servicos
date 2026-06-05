import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const defaultCallbackUrl = '/dashboard';

export async function requireSessionUser(callbackUrl = defaultCallbackUrl) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.warn('[auth] protected route without server session', { callbackUrl });
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { company: true } });
  if (!user?.active) {
    console.warn('[auth] protected route with inactive or missing user', { userId: session.user.id });
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return user;
}
