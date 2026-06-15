'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { deactivateClientAction, reactivateClientAction, updateClientAction } from '@/lib/actions';
import { deleteClientPermanentlyAction } from '@/lib/admin-delete-actions';
import type { ActionState } from '@/lib/actions';

type CompanyOption = { id: string; name: string };
type ClientItem = { id: string; name: string; email: string; companyId: string | null; active: boolean };

const initialState: ActionState = { status: 'idle', message: '' };

export function ClientManagementForms({ client, companies }: { client: ClientItem; companies: CompanyOption[] }) {
  const [editState, editAction] = useFormState(updateClientAction, initialState);
  const [deactivateState, deactivateAction] = useFormState(deactivateClientAction, initialState);
  const [reactivateState, reactivateAction] = useFormState(reactivateClientAction, initialState);
  const [deleteState, deleteAction] = useFormState(deleteClientPermanentlyAction, initialState);
  const state = [editState, deactivateState, reactivateState, deleteState].find((item) => item.message) ?? initialState;

  return (
    <div className="space-y-2">
      {state.message ? <p className={`text-xs ${messageClass(state.status)}`} role="status">{state.message}</p> : null}
      <form action={editAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
        <input type="hidden" name="clientId" value={client.id} />
        <input name="name" defaultValue={client.name} aria-label="Nome do cliente" required />
        <input name="email" type="email" defaultValue={client.email} aria-label="E-mail do cliente" required />
        <select name="companyId" defaultValue={client.companyId ?? ''} aria-label="Empresa do cliente" required>
          <option value="">Selecione</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <SubmitButton label="Editar cliente" pendingLabel="Salvando..." />
      </form>
      <div className="flex flex-wrap gap-2">
        {client.active ? <form action={deactivateAction}><input type="hidden" name="clientId" value={client.id} /><SubmitButton label="Inativar cliente" pendingLabel="Inativando..." secondary /></form> : <form action={reactivateAction}><input type="hidden" name="clientId" value={client.id} /><SubmitButton label="Reativar cliente" pendingLabel="Reativando..." secondary /></form>}
        <form action={deleteAction} onSubmit={(event) => {
          if (!confirm(`Excluir definitivamente o cliente ${client.name}? Isso tambem remove solicitacoes, orcamentos, anexos e historicos vinculados.`)) event.preventDefault();
        }}><input type="hidden" name="clientId" value={client.id} /><SubmitButton label="Excluir definitivamente" pendingLabel="Excluindo..." secondary /></form>
      </div>
    </div>
  );
}

function SubmitButton({ label, pendingLabel, secondary = false }: { label: string; pendingLabel: string; secondary?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={secondary ? 'btn-secondary' : 'btn'} type="submit" disabled={pending}>{pending ? pendingLabel : label}</button>;
}

function messageClass(status: ActionState['status']) {
  if (status === 'success') return 'text-green-700';
  if (status === 'warning') return 'text-amber-700';
  return 'text-red-600';
}
