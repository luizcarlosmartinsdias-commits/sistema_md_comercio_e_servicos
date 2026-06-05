'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <button className="btn-secondary" type="button" disabled={pending} onClick={handleSignOut}>
      {pending ? 'Saindo...' : 'Sair'}
    </button>
  );
}
