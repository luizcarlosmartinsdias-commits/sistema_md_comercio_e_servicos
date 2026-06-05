import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';

const dashboardPath = '/dashboard';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [CredentialsProvider({ name: 'credentials', credentials: { email: {}, password: {} }, async authorize(credentials) {
    const email = String(credentials?.email ?? '').toLowerCase().trim();
    const password = String(credentials?.password ?? '');
    const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
    if (!user?.active || !user.passwordHash) {
      console.info('[auth] credentials rejected: inactive or missing user');
      return null;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      console.info('[auth] credentials rejected: invalid password');
      return null;
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, companyName: user.company?.name } as any;
  } })],
  callbacks: {
    async jwt({ token, user }) { if (user) Object.assign(token, user); return token; },
    async session({ session, token }) { session.user = { ...session.user, id: token.id as string, role: token.role as any, companyId: token.companyId as string | null, companyName: token.companyName as string | undefined }; return session; },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        return `${baseUrl}${dashboardPath}`;
      }
      return `${baseUrl}${dashboardPath}`;
    }
  }
};
