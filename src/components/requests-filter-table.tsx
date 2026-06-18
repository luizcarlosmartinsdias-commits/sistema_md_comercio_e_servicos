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

type FilterValue = { text: string; selected: string };
type FilterKey = 'protocol' | 'company' | 'serial' | 'status' | 'requester';
type Filters = Record<FilterKey, FilterValue>;

const emptyFilter = { text: '', selected: '' };
const emptyFilters: Filters = {
  protocol: { ...emptyFilter },
  company: { ...emptyFilter },
  serial: { ...emptyFilter },
  status: { ...emptyFilter },
  requester: { ...emptyFilter }
};

const normalize = (value: string) => value.toLowerCase().trim();
const matches = (value: string, filter: FilterValue) => {
  const normalizedValue = normalize(value);
  const matchesText = normalizedValue.includes(normalize(filter.text));
  const matchesSelected = filter.selected ? value === filter.selected : true;
  return matchesText && matchesSelected;
};

const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

export function RequestsFilterTable({ requests, companies }: { requests: RequestRow[]; companies: CompanyOption[] }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const options = useMemo(() => ({
    protocol: uniqueSorted(requests.map((request) => request.protocol)),
    company: uniqueSorted(requests.map((request) => request.company.name)),
    serial: uniqueSorted(requests.map((request) => request.serial ?? '')),
    status: uniqueSorted(requests.map((request) => request.currentStatus)),
    requester: uniqueSorted(requests.map((request) => request.requester.name))
  }), [requests]);

  const filteredRequests = useMemo(() => requests.filter((request) => {
    return matches(request.protocol, filters.protocol)
      && matches(request.company.name, filters.company)
      && matches(request.serial ?? '', filters.serial)
      && matches(request.currentStatus, filters.status)
      && matches(request.requester.name, filters.requester);
  }), [requests, filters]);

  function updateFilter(key: FilterKey, field: keyof FilterValue, value: string) {
    setFilters((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  }

  function resetFilters() {
    setFilters(emptyFilters);
  }

  return <div className="mt-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">Exibindo {filteredRequests.length} de {requests.length} solicitações.</p>
      <button type="button" className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200" onClick={resetFilters}>Limpar filtros</button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Protocolo</th>
            <th>Empresa</th>
            <th>IMEI/Serial</th>
            <th>Status</th>
            <th>Solicitante</th>
            <th></th>
          </tr>
          <tr className="border-b bg-slate-50 align-top">
            <FilterCell label="protocolo" value={filters.protocol} options={options.protocol} onTextChange={(value) => updateFilter('protocol', 'text', value)} onSelectChange={(value) => updateFilter('protocol', 'selected', value)} />
            <FilterCell label="empresa" value={filters.company} options={options.company} onTextChange={(value) => updateFilter('company', 'text', value)} onSelectChange={(value) => updateFilter('company', 'selected', value)} />
            <FilterCell label="IMEI" value={filters.serial} options={options.serial} onTextChange={(value) => updateFilter('serial', 'text', value)} onSelectChange={(value) => updateFilter('serial', 'selected', value)} />
            <FilterCell label="status" value={filters.status} options={options.status} onTextChange={(value) => updateFilter('status', 'text', value)} onSelectChange={(value) => updateFilter('status', 'selected', value)} />
            <FilterCell label="solicitante" value={filters.requester} options={options.requester} onTextChange={(value) => updateFilter('requester', 'text', value)} onSelectChange={(value) => updateFilter('requester', 'selected', value)} />
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
    </div>
  </div>;
}

function FilterCell({ label, value, options, onTextChange, onSelectChange }: { label: string; value: FilterValue; options: string[]; onTextChange: (value: string) => void; onSelectChange: (value: string) => void }) {
  return <th className="space-y-1 py-2 pr-2">
    <input className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder={`Digitar ${label}`} value={value.text} onChange={(event) => onTextChange(event.target.value)} />
    <select className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" value={value.selected} onChange={(event) => onSelectChange(event.target.value)}>
      <option value="">Todos</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </th>;
}
