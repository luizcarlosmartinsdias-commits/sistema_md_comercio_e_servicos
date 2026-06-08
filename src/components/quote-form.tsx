'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createQuoteWithFeedbackAction } from '@/lib/quote-actions';
import type { ActionState } from '@/lib/actions';

type ServiceOption = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  defaultUnitCents: number;
};

const initialState: ActionState = { status: 'idle', message: '' };

export function QuoteForm({ requestId, services }: { requestId: string; services: ServiceOption[] }) {
  const [state, formAction] = useFormState(createQuoteWithFeedbackAction, initialState);
  const messageClass = state.status === 'success' ? 'text-green-700' : state.status === 'warning' ? 'text-amber-700' : 'text-red-600';

  return (
    <form action={formAction} encType="multipart/form-data" className="mt-6 grid gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <h3 className="text-sm font-semibold">Criar orçamento</h3>
        <p className="text-xs text-slate-500">Selecione os serviços cadastrados e ajuste quantidade ou valor apenas para este orçamento.</p>
      </div>
      {services.length > 0 ? <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b bg-slate-50"><th className="p-2">Usar</th><th>Serviço</th><th>Categoria</th><th>Qtd.</th><th>Valor unitário</th></tr></thead>
          <tbody>{services.map((service) => <tr key={service.id} className="border-b last:border-0 align-top"><td className="p-2"><input type="checkbox" name="serviceCatalogId" value={service.id} aria-label={`Selecionar ${service.name}`} /></td><td className="p-2"><strong>{service.name}</strong><br /><span className="text-xs text-slate-500">{service.description}</span></td><td className="p-2">{service.category ?? '-'}</td><td className="p-2"><input name={`quantity-${service.id}`} type="number" min="1" defaultValue="1" className="w-20" /></td><td className="p-2"><input name={`unitValue-${service.id}`} inputMode="decimal" defaultValue={(service.defaultUnitCents / 100).toFixed(2)} className="w-28" /></td></tr>)}</tbody>
        </table>
      </div> : <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Cadastre serviços no dashboard antes de criar um orçamento padronizado.</p>}
      <div className="grid gap-3 md:grid-cols-4">
        <input name="discountValue" inputMode="decimal" placeholder="Desconto" />
        <input name="validityDays" type="number" min="1" defaultValue="7" placeholder="Validade em dias" />
        <input name="executionDeadlineDays" type="number" min="1" defaultValue="5" placeholder="Prazo em dias" />
        <input name="warrantyDays" type="number" min="1" defaultValue="90" placeholder="Garantia em dias" />
      </div>
      <textarea name="notes" placeholder="Observação do orçamento" />
      <input name="file" type="file" />
      {state.message ? <p className={`text-sm ${messageClass}`} role="status">{state.message}</p> : null}
      <SubmitButton disabled={services.length === 0} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn" type="submit" disabled={disabled || pending}>{pending ? 'Gerando PDF...' : 'Gerar PDF do orçamento'}</button>;
}
