'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState, useTransition } from 'react';

type SetupResult = {
  tone: 'success' | 'error';
  title: string;
  message: string;
  summary?: string;
};

type SetupResponse = {
  message?: string;
  summary?: string;
};

export default function SetupMigratePage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/setup/migrate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const payload = await readResponse(response);
        setResult(toSetupResult(response.status, payload));
        if (response.ok) setToken('');
      } catch {
        setResult({
          tone: 'error',
          title: 'Erro ao executar migrations',
          message: 'Nao foi possivel conectar com a rota de migrations. Tente novamente em instantes.'
        });
      }
    });
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-69px)] max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1fr_0.9fr]">
      <section>
        <Image src="/brand/logo-md-horizontal.svg" alt="MD Comercio e Servicos" width={520} height={124} priority />
        <h1 className="mt-8 text-3xl font-bold text-mdgraphite">Preparar banco de dados</h1>
        <p className="mt-3 max-w-xl text-slate-600">Esta pagina temporaria executa as migrations Prisma no banco configurado na Vercel. Depois que as tabelas forem criadas, siga para a criacao do administrador.</p>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold">Executar migrations</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="setup-token">ADMIN_SETUP_TOKEN</label>
            <input id="setup-token" name="token" type="password" value={token} onChange={(event) => setToken(event.target.value)} required autoComplete="off" />
          </div>
          <button className="btn w-full" type="submit" disabled={pending}>{pending ? 'Executando...' : 'Executar migration'}</button>
        </form>

        {result ? <div className={`mt-5 rounded-md border px-4 py-3 text-sm ${result.tone === 'success' ? resultClasses.success : resultClasses.error}`} role="status">
          <strong className="block">{result.title}</strong>
          <span>{result.message}</span>
          {result.summary ? <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs">{result.summary}</pre> : null}
          {result.tone === 'success' ? <Link className="mt-4 inline-block font-semibold text-mdblue" href="/setup-admin">Ir para criar administrador</Link> : null}
        </div> : null}

        <Link className="mt-5 inline-block text-sm font-medium text-mdblue" href="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}

const resultClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800'
};

async function readResponse(response: Response): Promise<SetupResponse> {
  try {
    return await response.json() as SetupResponse;
  } catch {
    return {};
  }
}

function toSetupResult(status: number, payload: SetupResponse): SetupResult {
  if (status === 200) {
    return {
      tone: 'success',
      title: 'Migrations executadas',
      message: 'O banco foi preparado com sucesso. Agora acesse /setup-admin para criar o administrador.',
      summary: payload.summary
    };
  }

  if (status === 401) {
    return {
      tone: 'error',
      title: 'Token invalido',
      message: 'O token informado nao confere com ADMIN_SETUP_TOKEN.'
    };
  }

  return {
    tone: 'error',
    title: 'Erro na migration',
    message: payload.message ?? 'Nao foi possivel executar as migrations.',
    summary: payload.summary
  };
}
