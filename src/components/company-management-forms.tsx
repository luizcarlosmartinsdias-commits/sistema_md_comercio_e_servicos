'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { deleteCompanyPermanentlyAction } from '@/lib/admin-delete-actions';
import type { ActionState } from '@/lib/actions';

type CompanyItem = { id: string; name: string };
const initialState: ActionState = { status: 'idle', message: '' };

export function CompanyManagementForms({ company }: { company: CompanyItem }) {
  const [deleteState, deleteAction] = useFormState(deleteCompanyPermanentlyAction, initialState);

  return (
    <div className="space-y-2">
      {deleteState.message ? <p className={`text-xs ${messageClass(deleteState.status)}`} role="status">{deleteState.message}</p> : null}
      <form action={deleteAction} onSubmit={(event) => {
        if (!confirm(`Excluir definitivamente a empresa ${company.name}? Isso tambem remove clientes, convites, solicitacoes, orcamentos, anexos e historicos vinculados.`)) event.preventDefault();
      }}>
        <input type="hidden" name="companyId" value={company.id} />
        <SubmitButton label="Excluir definitivamente" pendingLabel="Excluindo..." />
      </form>
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-secondary" type="submit" disabled={pending}>{pending ? pendingLabel : label}</button>;
}

function messageClass(status: ActionState['status']) {
  if (status === 'success') return 'text-green-700';
  if (status === 'warning') return 'text-amber-700';
  return 'text-red-600';
}
