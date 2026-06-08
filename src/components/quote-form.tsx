'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/lib/actions';

type ServiceOption = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  defaultUnitCents: number;
};

type QuoteResponse = ActionState & { quoteId?: string };

const initialState: ActionState = { status: 'idle', message: '' };

export function QuoteForm({ requestId, services }: { requestId: string; services: ServiceOption[] }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(initialState);
  const [pending, setPending] = useState(false);
  const messageClass = state.status === 'success' ? 'text-green-700' : state.status === 'warning' ? 'text-amber-700' : 'text-red-600';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const selectedIds = form.getAll('serviceCatalogId').map((value) => String(value)).filter(Boolean);
    if (selectedIds.length === 0) {
      setState({ status: 'error', message: 'Selecione pelo menos um serviço.' });
      return;
    }

    const payload = {
      requestId,
      services: selectedIds.map((serviceId) => ({
        serviceCatalogId: serviceId,
        quantity: Number(form.get(`quantity-${serviceId}`) || 1),
        unitValue: String(form.get(`unitValue-${serviceId}`) ?? '')
      })),
      discountValue: String(form.get('discountValue') ?? ''),
      validityDays: Number(form.get('validityDays') || 7),
      executionDeadlineDays: Number(form.get('executionDeadlineDays') || 5),
      warrantyDays: Number(form.get('warrantyDays') || 90),
      notes: String(form.get('notes') ?? '')
    };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setPending(true);
    setState({ status: 'idle', message: '' });

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null) as QuoteResponse | null;
      if (!response.ok) {
        setState({ status: 'error', message: data?.message || 'Não foi possível criar o orçamento. Tente novamente.' });
        return;
      }
      setState({ status: data?.status || 'success', message: data?.message || 'Orçamento criado e enviado ao cliente por e-mail.' });
      router.refresh();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      setState({ status: 'error', message: timedOut ? 'Tempo limite ao criar orçamento. Tente novamente.' : 'Não foi possível criar o orçamento. Tente novamente.' });
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
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
      {state.message ? <p className={`text-sm ${messageClass}`} role="status">{state.message}</p> : null}
      <button className="btn" type="submit" disabled={services.length === 0 || pending}>{pending ? 'Gerando orçamento...' : 'Criar orçamento'}</button>
    </form>
  );
}
