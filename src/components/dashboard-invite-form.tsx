'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { inviteUserAction } from '@/lib/actions';
import type { ActionState } from '@/lib/actions';

type CompanyOption = { id: string; name: string };
type RoleOption = { value: string; label: string };

const initialState: ActionState = { status: 'idle', message: '' };

export function DashboardInviteForm({ companies, roles }: { companies: CompanyOption[]; roles: RoleOption[] }) {
  const [state, formAction] = useFormState(inviteUserAction, initialState);
  const messageClass = state.status === 'success' ? 'text-green-700' : state.status === 'warning' ? 'text-amber-700' : 'text-red-600';

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <input name="name" placeholder="Nome" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <select name="role" required>
        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
      </select>
      <select name="companyId">
        <option value="">Sem empresa / administrador</option>
        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
      {state.message ? <p className={`text-sm ${messageClass}`} role="status">{state.message}</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={pending}>{pending ? 'Enviando...' : 'Enviar convite'}</button>;
}
