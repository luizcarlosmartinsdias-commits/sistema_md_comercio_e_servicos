'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(params.get('error'));
  const [pending, startTransition] = useTransition();

  return (
    <form className="mt-5 space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(async () => {
        const result = await signIn('credentials', { email: formData.get('email'), password: formData.get('password'), redirect: false });
        if (result?.ok) router.push('/dashboard');
        else setError('Credenciais invalidas ou usuario inativo.');
      });
    }}>
      <div><label>E-mail</label><input name="email" type="email" required /></div>
      <div><label>Senha</label><input name="password" type="password" required /></div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="btn w-full" disabled={pending}>{pending ? 'Entrando...' : 'Entrar'}</button>
    </form>
  );
}
