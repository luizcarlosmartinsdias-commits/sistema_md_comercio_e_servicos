'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const dashboardPath = '/dashboard';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: dashboardPath
      });

      if (result?.error) {
        setError('Credenciais invalidas ou usuario inativo.');
        return;
      }

      if (result?.ok) {
        router.push(normalizeInternalUrl(result.url) ?? dashboardPath);
        router.refresh();
        return;
      }

      setError('Nao foi possivel confirmar o login. Tente novamente.');
    } catch {
      setError('Erro ao tentar entrar. Verifique sua conexao e tente novamente.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <div><label>E-mail</label><input name="email" type="email" required autoComplete="email" /></div>
      <div><label>Senha</label><input name="password" type="password" required autoComplete="current-password" /></div>
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      <button className="btn w-full" type="submit" disabled={pending}>{pending ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}

function normalizeInternalUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return dashboardPath;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return dashboardPath;
  }
}
