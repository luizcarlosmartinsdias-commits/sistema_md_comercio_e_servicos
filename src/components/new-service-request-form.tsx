'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { createNormalizedServiceRequestAction } from '@/lib/service-request-create';
import { normalizeImei } from '@/lib/imei';
import { warrantyStatusLabel } from '@/lib/status-labels';

type WarrantyHit = {
  active: boolean;
  warrantyId?: string;
  originRequestId?: string;
  originProtocol?: string;
  endDate?: string;
  status?: string;
  problem?: string;
  equipment?: string;
};

export function NewServiceRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [checking, setChecking] = useState(false);
  const [allowNewOs, setAllowNewOs] = useState(false);
  const [warranty, setWarranty] = useState<WarrantyHit | null>(null);
  const [imeiError, setImeiError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (allowNewOs) return;
    const form = event.currentTarget;
    const serial = normalizeImei(String(new FormData(form).get('serial') ?? ''));

    if (serial.length !== 15) {
      event.preventDefault();
      setImeiError('Informe o IMEI com exatamente 15 algarismos numéricos.');
      return;
    }

    event.preventDefault();
    setImeiError('');
    setChecking(true);
    const response = await fetch(`/api/warranty-check?serial=${encodeURIComponent(serial)}`);
    const result = await response.json() as WarrantyHit;
    setChecking(false);

    if (result.active) {
      setWarranty(result);
      return;
    }

    setAllowNewOs(true);
    setTimeout(() => form.requestSubmit(), 0);
  }

  function continueNewOs() {
    setAllowNewOs(true);
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  function onlyDigits(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.value = normalizeImei(event.currentTarget.value);
  }

  return <div className="space-y-4">
    {warranty?.active ? <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <h3 className="text-base font-semibold">Garantia ativa identificada</h3>
      <p className="mt-2 font-semibold">Este equipamento possui garantia ativa.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div><span className="font-semibold">O.S. de origem</span><br />{warranty.originProtocol}</div>
        <div><span className="font-semibold">Garantia válida até</span><br />{warranty.endDate ? new Date(warranty.endDate).toLocaleDateString('pt-BR') : '-'}</div>
        <div><span className="font-semibold">Status</span><br />{warrantyStatusLabel(warranty.status ?? null)}</div>
      </div>
      <p className="mt-3">Verifique se o problema atual é o mesmo do atendimento anterior. Se for o mesmo problema, solicite atendimento em garantia. Se for outro problema, continue abrindo uma nova O.S.</p>
      {warranty.problem ? <p className="mt-2 rounded bg-white/70 p-2"><strong>Problema anterior:</strong> {warranty.problem}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {warranty.originRequestId ? <Link className="btn" href={`/requests/${warranty.originRequestId}#garantia`}>Solicitar atendimento em garantia</Link> : null}
        <button type="button" className="btn-secondary" onClick={continueNewOs}>Continuar com nova O.S.</button>
      </div>
    </div> : null}

    <form ref={formRef} action={createNormalizedServiceRequestAction} onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="setor" placeholder="Setor" required />
      <input name="responsavel" placeholder="Responsável" required />
      <input name="telefone" placeholder="Telefone" required />
      <input name="tipoAparelho" placeholder="Tipo de aparelho" required />
      <input name="marca" placeholder="Marca" required />
      <input name="modelo" placeholder="Modelo" required />
      <div>
        <input name="serial" placeholder="IMEI - 15 números" inputMode="numeric" pattern="[0-9]{15}" maxLength={15} minLength={15} title="Informe exatamente 15 algarismos numéricos" onInput={onlyDigits} required />
        {imeiError ? <p className="mt-1 text-xs text-red-600">{imeiError}</p> : null}
      </div>
      <textarea name="problema" placeholder="Problema informado" required className="md:col-span-2" />
      <textarea name="observacoes" placeholder="Observações" className="md:col-span-2" />
      <button className="btn md:col-span-2" disabled={checking}>{checking ? 'Verificando garantia...' : 'Abrir solicitação'}</button>
    </form>
  </div>;
}
