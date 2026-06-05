'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState, useTransition } from 'react';

type SetupResult = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
};

type SetupResponse = {
  message?: string;
  missing?: string[];
};

export default function SetupAdminPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/setup/admin', {
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
          title: 'Erro ao chamar setup',
          message: 'Nao foi possivel conectar com a rota de inicializacao. Tente novamente em instantes.'
        });
      }
    });
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-69px)] max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1fr_0.9fr]">
      <section>
        <Image src="/brand/logo-md-horizontal.svg" alt="MD Comercio e Servicos" width={520} height={124} priority />
        <h1 className="mt-8 text-3xl font-bold text-mdgraphite">Inicializacao segura do administrador</h1>
        <p className="mt-3 max-w-xl text-slate-600">Esta pagina temporaria cria o primeiro ADMIN_MD usando apenas as variaveis configuradas no servidor. Remova ou bloqueie este acesso apos concluir o setup.</p>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold">Criar administrador</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="setup-token">ADMIN_SETUP_TOKEN</label>
            <input id="setup-token" name="token" type="password" value={token} onChange={(event) => setToken(event.target.value)} required autoComplete="off" />
          </div>
          <button className="btn w-full" type="submit" disabled={pending}>{pending ? 'Criando...' : 'Criar administrador'}</button>
        </form>

        {result ? <div className={`mt-5 rounded-md border px-4 py-3 text-sm ${resultClasses[result.tone]}`} role="status">
          <strong className="block">{result.title}</strong>
          <span>{result.message}</span>
        </div> : null}

        <Link className="mt-5 inline-block text-sm font-medium text-mdblue" href="/login">Voltar ao login</Link>
      </section>
    </main>
  );
}

const resultClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
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
  if (status === 201) {
    return {
      tone: 'success',
      title: 'Administrador criado',
      message: 'O administrador inicial foi criado com sucesso. Acesse o login com o e-mail e senha configurados na Vercel.'
    };
  }

  if (status === 200) {
    return {
      tone: 'warning',
      title: 'Administrador ja inicializado',
      message: 'Ja existe um usuario ADMIN_MD ativo. Nenhum novo administrador foi criado.'
    };
  }

  if (status === 401) {
    return {
      tone: 'error',
      title: 'Token invalido',
      message: 'O token informado nao confere com ADMIN_SETUP_TOKEN.'
    };
  }

  if (status === 500 && payload.missing?.length) {
    return {
      tone: 'error',
      title: 'Configuracao incompleta',
      message: `Faltam variaveis de ambiente no servidor: ${payload.missing.join(', ')}.`
    };
  }

  return {
    tone: 'error',
    title: 'Erro no setup',
    message: payload.message ?? 'Nao foi possivel inicializar o administrador.'
  };
}
