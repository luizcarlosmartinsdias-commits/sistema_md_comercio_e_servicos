'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { acceptInvitationAction, ActionState } from '@/lib/actions';

const initialState: ActionState = { status: 'idle', message: '' };

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(acceptInvitationAction, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label>Senha</label>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <div>
        <label>Confirmar senha</label>
        <input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      {state.message ? <p className="text-sm text-red-600" role="alert">{state.message}</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn w-full" type="submit" disabled={pending}>{pending ? 'Criando acesso...' : 'Criar senha'}</button>;
}
