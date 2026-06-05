import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-69px)] max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1.1fr_0.9fr]">
      <section>
        <Image src="/brand/logo-md-horizontal.svg" alt="MD Comercio e Servicos" width={520} height={124} priority />
        <h1 className="mt-8 text-3xl font-bold text-mdgraphite">Assistencia tecnica B2B com rastreabilidade ponta a ponta.</h1>
        <p className="mt-3 max-w-xl text-slate-600">Acesse solicitacoes, orcamentos, O.S., notas fiscais e historico de status da sua empresa.</p>
      </section>
      <section className="card">
        <h2 className="text-xl font-semibold">Entrar</h2>
        <LoginForm />
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-mdblue">Esqueci minha senha</Link>
      </section>
    </main>
  );
}
