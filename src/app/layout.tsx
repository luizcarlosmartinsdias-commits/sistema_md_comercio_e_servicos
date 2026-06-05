import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signOutAction } from '@/lib/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portal MD Comercio e Servicos',
  description: 'Portal B2B de assistencia tecnica da MD Comercio e Servicos',
  icons: { icon: '/brand/favicon.svg' }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image src="/brand/logo-md-icon.svg" alt="MD" width={42} height={42} />
              <span className="font-semibold text-mdgraphite">Portal MD</span>
            </Link>
            {session?.user ? (
              <form action={signOutAction} className="flex items-center gap-3 text-sm text-slate-600">
                <span>{session.user.name}</span>
                <button className="btn-secondary" type="submit">Sair</button>
              </form>
            ) : null}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
