'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createServiceCatalogAction, deactivateServiceCatalogAction, deleteServiceCatalogAction, reactivateServiceCatalogAction, updateServiceCatalogAction } from '@/lib/actions';
import type { ActionState } from '@/lib/actions';

type ServiceItem = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  defaultUnitCents: number;
  active: boolean;
  createdAt: string;
};

const initialState: ActionState = { status: 'idle', message: '' };

export function ServiceCatalogForms({ services }: { services: ServiceItem[] }) {
  const [createState, createAction] = useFormState(createServiceCatalogAction, initialState);

  return (
    <div className="mt-4 space-y-5">
      <form action={createAction} className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
        <input name="name" placeholder="Nome do servico" required />
        <input name="category" placeholder="Categoria" />
        <input name="defaultUnitValue" inputMode="decimal" placeholder="Valor padrao" required />
        <SubmitButton label="Cadastrar" pendingLabel="Salvando..." />
        <textarea name="description" placeholder="Descricao" required className="md:col-span-4" />
        {createState.message ? <p className={`text-sm md:col-span-4 ${messageClass(createState.status)}`} role="status">{createState.message}</p> : null}
      </form>

      <div className="space-y-3">
        {services.map((service) => <ServiceRow key={service.id} service={service} />)}
        {services.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhum servico cadastrado.</p> : null}
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceItem }) {
  const [editState, editAction] = useFormState(updateServiceCatalogAction, initialState);
  const [deactivateState, deactivateAction] = useFormState(deactivateServiceCatalogAction, initialState);
  const [reactivateState, reactivateAction] = useFormState(reactivateServiceCatalogAction, initialState);
  const [deleteState, deleteAction] = useFormState(deleteServiceCatalogAction, initialState);
  const state = [editState, deactivateState, reactivateState, deleteState].find((item) => item.message) ?? initialState;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      {state.message ? <p className={`mb-2 text-xs ${messageClass(state.status)}`} role="status">{state.message}</p> : null}
      <form action={editAction} className="grid gap-2 md:grid-cols-[1fr_1fr_130px_auto]">
        <input type="hidden" name="serviceId" value={service.id} />
        <input name="name" defaultValue={service.name} aria-label="Nome do servico" required />
        <input name="category" defaultValue={service.category ?? ''} aria-label="Categoria" />
        <input name="defaultUnitValue" defaultValue={(service.defaultUnitCents / 100).toFixed(2)} inputMode="decimal" aria-label="Valor padrao" required />
        <SubmitButton label="Editar" pendingLabel="Salvando..." />
        <textarea name="description" defaultValue={service.description} aria-label="Descricao" required className="md:col-span-4" />
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Status: {service.active ? 'ativo' : 'inativo'} | Criado em {service.createdAt}</span>
        <div className="flex flex-wrap gap-2">
          {service.active ? <form action={deactivateAction}><input type="hidden" name="serviceId" value={service.id} /><SubmitButton label="Inativar" pendingLabel="Inativando..." secondary /></form> : <form action={reactivateAction}><input type="hidden" name="serviceId" value={service.id} /><SubmitButton label="Reativar" pendingLabel="Reativando..." secondary /></form>}
          <form action={deleteAction}><input type="hidden" name="serviceId" value={service.id} /><SubmitButton label="Excluir" pendingLabel="Excluindo..." secondary /></form>
        </div>
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
