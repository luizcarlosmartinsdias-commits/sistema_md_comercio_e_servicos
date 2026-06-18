'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RequestManagementForms } from '@/components/request-management-forms';

type RequestRow = {
  id: string;
  protocol: string;
  currentStatus: string;
  serial: string;
  company: { name: string };
  requester: { name: string };
};

type CompanyOption = { id: string; name: string };

type Filters = {
  protocol: string;
  company: string;
  serial: string;
  status: string;
  requester: string;
};

const emptyFilters: Filters = {
  protocol: '',
  company: '',
  serial: '',
  status: '',
  requester: ''
};

const contains = (value: string, filter: string) => value.toLowerCase().includes(filter.toLowerCase().trim());

export function RequestsFilterTable({ requests, companies }: { requests: RequestRow[]; companies: CompanyOption[] }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const filteredRequests = useMemo(() => requests.filter((request) => {
    return contains(request.protocol, filters.protocol)
      && contains(request.company.name, filters.company)
      && contains(request.serial ?? '', filters.serial)
      && contains(request.currentStatus, filters.status)
      && contains(request.requester.name, filters.requester);
  }), [requests, filters]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return <div className="mt-4 overflow-x-auto">
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2">Protocolo</th>
          <th>Empresa</th>
          <th>IMEI/Serial</th>
          <th>Status</th>
          <th>Solicitante</th>
          <th></th>
        </tr>
        <tr className="border-b bg-slate-50">
          <th className="py-2 pr-2"><input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Filtrar protocolo" value={filters.protocol} onChange={(event) => updateFilter('protocol', event.target.value)} /></th>
          <th className="pr-2"><input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Filtrar empresa" value={filters.company} onChange={(event) => updateFilter('company', event.target.value)} /></th>
          <th className="pr-2"><input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Filtrar IMEI" value={filters.serial} onChange={(event) => updateFilter('serial', event.target.value)} /></th>
          <th className="pr-2"><input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Filtrar status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} /></th>
          <th className="pr-2"><input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Filtrar solicitante" value={filters.requester} onChange={(event) => updateFilter('requester', event.target.value)} /></th>
          <th></th>
        </tr>
      </thead>
      <tbody>{filteredRequests.map((request: any) => <tr key={request.id} className="border-b last:border-0">
        <td className="py-3 font-medium">{request.protocol}</td>
        <td>{request.company.name}</td>
        <td>{request.serial || '-'}</td>
        <td><span className="badge">{request.currentStatus}</span></td>
        <td>{request.requester.name}</td>
        <td><Link className="font-semibold text-mdblue" href={`/requests/${request.id}`}>Abrir</Link>{companies.length > 0 ? <div className="mt-2"><RequestManagementForms request={request} companies={companies} /></div> : null}</td>
      </tr>)}</tbody>
    </table>
    {requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitação cadastrada.</p> : null}
    {requests.length > 0 && filteredRequests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitação encontrada com os filtros informados.</p> : null}
  </div>;
}
