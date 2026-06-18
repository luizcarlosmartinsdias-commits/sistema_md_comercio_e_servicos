'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { deleteServiceRequestAction, updateServiceRequestAction } from '@/lib/request-actions';
import { normalizeImei } from '@/lib/imei';
import type { ActionState } from '@/lib/actions';

type CompanyOption = { id: string; name: string };
type RequestItem = {
  id: string;
  companyId: string;
  setor: string;
  responsavel: string;
  telefone: string;
  tipoAparelho: string;
  marca: string;
  modelo: string;
  serial: string;
  problema: string;
  observacoes: string | null;
};

const initialState: ActionState = { status: 'idle', message: '' };

export function RequestManagementForms({ request, companies }: { request: RequestItem; companies: CompanyOption[] }) {
  const [editState, editAction] = useFormState(updateServiceRequestAction, initialState);
  const [deleteState, deleteAction] = useFormState(deleteServiceRequestAction, initialState);
  const state = [editState, deleteState].find((item) => item.message) ?? initialState;

  function onlyDigits(event: React.FormEvent<HTMLInputElement>) {
    event.currentTarget.value = normalizeImei(event.currentTarget.value);
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-3">
      {state.message ? <p className={`text-xs ${messageClass(state.status)}`} role="status">{state.message}</p> : null}
      <form action={editAction} className="grid gap-2 md:grid-cols-3">
        <input type="hidden" name="requestId" value={request.id} />
        <select name="companyId" defaultValue={request.companyId} aria-label="Empresa" required>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <input name="setor" defaultValue={request.setor} placeholder="Setor" required />
        <input name="responsavel" defaultValue={request.responsavel} placeholder="Responsável" required />
        <input name="telefone" defaultValue={request.telefone} placeholder="Telefone" required />
        <input name="tipoAparelho" defaultValue={request.tipoAparelho} placeholder="Tipo de aparelho" required />
        <input name="marca" defaultValue={request.marca} placeholder="Marca" required />
        <input name="modelo" defaultValue={request.modelo} placeholder="Modelo" required />
        <input name="serial" defaultValue={normalizeImei(request.serial)} placeholder="IMEI - 15 números" inputMode="numeric" pattern="[0-9]{15}" maxLength={15} minLength={15} title="Informe exatamente 15 algarismos numéricos" onInput={onlyDigits} required />
        <input name="problema" defaultValue={request.problema} placeholder="Problema informado" required />
        <textarea name="observacoes" defaultValue={request.observacoes ?? ''} placeholder="Observações" className="md:col-span-3" />
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <SubmitButton label="Salvar alterações" pendingLabel="Salvando..." />
        </div>
      </form>
      <form action={deleteAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="requestId" value={request.id} />
        <SubmitButton label="Excluir solicitação" pendingLabel="Excluindo..." secondary />
      </form>
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
