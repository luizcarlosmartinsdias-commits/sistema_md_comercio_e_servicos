import Link from 'next/link';
import { QuoteStatus, ServiceRequestStatus } from '@prisma/client';
import { requireSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { canManageMd } from '@/lib/rbac';
import { formatMoney } from '@/lib/format';
import { markNfseIssuedAction, prepareNfseEmissionAction } from '@/lib/nfse';
import { serviceRequestStatusLabel } from '@/lib/status-labels';

const noteStatuses: ServiceRequestStatus[] = [
  ServiceRequestStatus.NOTA_SOLICITADA,
  ServiceRequestStatus.NOTA_EMITIDA,
  ServiceRequestStatus.SERVICO_CONCLUIDO,
  ServiceRequestStatus.FINALIZADO
];

export default async function InvoicesPage() {
  const user = await requireSessionUser();
  const admin = canManageMd(user.role);
  const requests = await prisma.serviceRequest.findMany({
    where: admin ? { currentStatus: { in: noteStatuses } } : { requesterId: user.id, currentStatus: { in: noteStatuses } },
    include: {
      company: true,
      requester: true,
      quotes: {
        where: { status: QuoteStatus.APROVADO },
        include: { items: true },
        orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Notas fiscais</h1><p className="text-sm text-slate-600">Pré-emissão da NFS-e Nacional para emissão direta pelo sistema.</p></div><Link href="/dashboard" className="text-sm font-semibold text-mdblue">Voltar ao painel</Link></div>
    <section className="card"><h2 className="font-semibold">Configuração fiscal padrão</h2><div className="mt-4 grid gap-3 text-sm md:grid-cols-4"><Info label="Município" value="Araruama/RJ" /><Info label="Código IBGE" value="3300209" /><Info label="Inscrição municipal" value="8003346" /><Info label="Serviço" value="14.02.01 - Assistência técnica" /></div></section>
    <section className="space-y-4">{requests.map((request) => { const quote = request.quotes[0]; const items = quote?.items.map((item) => item.description.split(':')[0].trim()).filter(Boolean) ?? []; const suggestedDescription = `Conserto de eletroeletrônico conforme O.S. ${request.protocol}. Serviços realizados: ${items.join(', ') || 'assistência técnica'}.`; return <article key={request.id} className="card space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold"><Link href={`/requests/${request.id}`} className="text-mdblue">{request.protocol}</Link></h2><p className="text-sm text-slate-600">{request.company.name} - {request.tipoAparelho} {request.marca} {request.modelo}</p></div><span className="badge">{serviceRequestStatusLabel(request.currentStatus)}</span></div><div className="grid gap-3 text-sm md:grid-cols-4"><Info label="Solicitante" value={request.requester.name} /><Info label="Tomador" value={request.company.name} /><Info label="Documento" value={request.company.document ?? 'Não informado'} /><Info label="Valor" value={quote ? formatMoney(quote.totalCents) : 'Sem orçamento aprovado'} /></div><div className="rounded-md bg-slate-50 p-3 text-sm"><p className="font-semibold">Descrição sugerida da NFS-e</p><p className="mt-1 text-slate-700">{suggestedDescription}</p></div>{admin ? <div className="grid gap-3 md:grid-cols-2"><form action={prepareNfseEmissionAction} className="rounded-md border border-slate-200 p-3"><input type="hidden" name="requestId" value={request.id} /><p className="text-sm text-slate-600">Prepara o registro para a futura emissão direta via API Nacional.</p><button className="btn mt-3">Preparar emissão direta</button></form><form action={markNfseIssuedAction} className="grid gap-2 rounded-md border border-slate-200 p-3"><input type="hidden" name="requestId" value={request.id} /><input name="nfseNumber" placeholder="Número da NFS-e" /><input name="accessKey" placeholder="Chave de acesso" /><button className="btn-secondary">Marcar como emitida</button></form></div> : null}</article>; })}{requests.length === 0 ? <section className="card"><p className="text-sm text-slate-500">Nenhuma O.S. pronta ou solicitada para nota fiscal.</p></section> : null}</section>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="font-semibold">{label}</span><br />{value}</div>;
}
