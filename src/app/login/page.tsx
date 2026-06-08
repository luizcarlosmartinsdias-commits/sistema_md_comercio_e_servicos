import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';
import { authOptions } from '@/lib/auth';

export default async function LoginPage({ searchParams }: { searchParams?: { message?: string } }) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect('/dashboard');

  const message = searchParams?.message === 'cadastro-criado' ? 'Cadastro criado com sucesso. Faça login.' : null;

  return (
    <main className="mx-auto grid min-h-[calc(100vh-69px)] max-w-6xl items-center gap-12 px-4 py-10 md:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col items-start">
        <div className="w-full max-w-xl rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black tracking-tight text-white shadow-sm">
              MD
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black tracking-tight text-mdgraphite">MD Comércio e Serviços</p>
              <p className="mt-1 text-sm font-medium text-slate-500">Assistência técnica B2B para eletrônicos</p>
            </div>
          </div>
        </div>
        <h1 className="mt-10 max-w-xl text-3xl font-bold leading-tight text-mdgraphite">Assistência técnica B2B com rastreabilidade ponta a ponta.</h1>
        <p className="mt-3 max-w-xl text-slate-600">Acesse solicitações, orçamentos, ordens de serviço, notas fiscais e histórico de status da sua empresa.</p>
      </section>
      <section className="card">
        <h2 className="text-xl font-semibold">Entrar</h2>
        {message ? <p className="mt-3 text-sm text-green-700" role="status">{message}</p> : null}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-mdblue">Esqueci minha senha</Link>
      </section>
    </main>
  );
}
