import { AttachmentType, ServiceRequestStatus } from '@prisma/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { canApproveQuote, canManageMd, canRequestInvoice } from '@/lib/rbac';
import { approveQuoteAction, createQuoteAction, rejectQuoteAction, requestInvoiceAction, updateStatusAction, uploadAttachmentAction } from '@/lib/actions';
import { formatMoney } from '@/lib/format';

export default async function RequestPage({ params }: { params: { id: string } }) {
  const user = await requireSessionUser();
  const mdUser = canManageMd(user.role);
  const request = await prisma.serviceRequest.findFirst({
    where: { id: params.id, ...(mdUser ? {} : { companyId: user.companyId ?? '' }) },
    include: {
      company: true,
      requester: true,
      statusHistory: { include: { changedBy: true }, orderBy: { createdAt: 'desc' } },
      quotes: { include: { items: { include: { serviceCatalog: true } }, attachment: true, pdfAttachment: true }, orderBy: { createdAt: 'desc' } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } }
    }
  });
  if (!request) notFound();
  const serviceCatalog = mdUser ? await prisma.serviceCatalog.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }) : [];
  const latestQuote = request.quotes[0];
  const canDecideQuote = Boolean(latestQuote && canApproveQuote(user.role) && latestQuote.status === 'ENVIADO' && request.currentStatus === ServiceRequestStatus.AGUARDANDO_APROVACAO);
  const attachmentOptions = mdUser
    ? [AttachmentType.FOTO_PROBLEMA, AttachmentType.OS_ASSINADA_MD, AttachmentType.NOTA_FISCAL, AttachmentType.OUTRO]
    : [AttachmentType.FOTO_PROBLEMA, AttachmentType.OS_CLIENTE, AttachmentType.OUTRO];

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <Link href="/dashboard" className="text-sm font-semibold text-mdblue">Voltar</Link>

    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{request.protocol}</h1>
          <p className="text-sm text-slate-600">{request.company.name} - {request.tipoAparelho} {request.marca} {request.modelo}</p>
        </div>
        <span className="badge">{request.currentStatus}</span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div><dt className="font-semibold">Responsavel</dt><dd>{request.responsavel}</dd></div>
        <div><dt className="font-semibold">Telefone</dt><dd>{request.telefone}</dd></div>
        <div><dt className="font-semibold">Serial/IMEI</dt><dd>{request.serial}</dd></div>
        <div className="md:col-span-3"><dt className="font-semibold">Problema</dt><dd>{request.problema}</dd></div>
      </dl>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      {mdUser ? <div className="card">
        <h2 className="font-semibold">Operacao MD</h2>
        <form action={updateStatusAction} className="mt-4 grid gap-3">
          <input type="hidden" name="requestId" value={request.id} />
          <select name="status" defaultValue={request.currentStatus}>{Object.values(ServiceRequestStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <input name="note" placeholder="Observacao do status" />
          <button className="btn">Alterar status</button>
        </form>

        <form action={createQuoteAction} encType="multipart/form-data" className="mt-6 grid gap-4">
          <input type="hidden" name="requestId" value={request.id} />
          <div>
            <h3 className="text-sm font-semibold">Criar orcamento</h3>
            <p className="text-xs text-slate-500">Selecione os servicos cadastrados e ajuste quantidade ou valor apenas para este orcamento.</p>
          </div>
          {serviceCatalog.length > 0 ? <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b bg-slate-50"><th className="p-2">Usar</th><th>Servico</th><th>Categoria</th><th>Qtd.</th><th>Valor unitario</th></tr></thead>
              <tbody>{serviceCatalog.map((service) => <tr key={service.id} className="border-b last:border-0 align-top"><td className="p-2"><input type="checkbox" name="serviceCatalogId" value={service.id} aria-label={`Selecionar ${service.name}`} /></td><td className="p-2"><strong>{service.name}</strong><br /><span className="text-xs text-slate-500">{service.description}</span></td><td className="p-2">{service.category ?? '-'}</td><td className="p-2"><input name={`quantity-${service.id}`} type="number" min="1" defaultValue="1" className="w-20" /></td><td className="p-2"><input name={`unitValue-${service.id}`} inputMode="decimal" defaultValue={(service.defaultUnitCents / 100).toFixed(2)} className="w-28" /></td></tr>)}</tbody>
            </table>
          </div> : <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Cadastre servicos no dashboard antes de criar um orcamento padronizado.</p>}
          <div className="grid gap-3 md:grid-cols-4">
            <input name="discountValue" inputMode="decimal" placeholder="Desconto" />
            <input name="validityDays" type="number" min="1" defaultValue="7" placeholder="Validade em dias" />
            <input name="executionDeadlineDays" type="number" min="1" defaultValue="5" placeholder="Prazo em dias" />
            <input name="warrantyDays" type="number" min="1" defaultValue="90" placeholder="Garantia em dias" />
          </div>
          <textarea name="notes" placeholder="Observacao do orcamento" />
          <input name="file" type="file" />
          <button className="btn" disabled={serviceCatalog.length === 0}>Gerar PDF e enviar orcamento</button>
        </form>
      </div> : null}

      <div className="card">
        <h2 className="font-semibold">Anexos e documentos</h2>
        <form action={uploadAttachmentAction} encType="multipart/form-data" className="mt-4 grid gap-3">
          <input type="hidden" name="requestId" value={request.id} />
          <select name="type">{attachmentOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <input name="file" type="file" required />
          <button className="btn">Enviar anexo</button>
        </form>
        {canRequestInvoice(user.role) ? <form action={requestInvoiceAction} className="mt-4"><input type="hidden" name="requestId" value={request.id} /><button className="btn-secondary">Solicitar nota fiscal</button></form> : null}
        <ul className="mt-4 space-y-2 text-sm">{request.attachments.map((attachment) => <li key={attachment.id} className="flex justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"><span>{attachment.type} - {attachment.fileName}</span><a className="font-semibold text-mdblue" href={`/api/attachments/${attachment.id}`}>Baixar</a></li>)}</ul>
      </div>
    </section>

    {latestQuote ? <section className="card">
      <h2 className="font-semibold">Orcamento</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2"><p><strong>{latestQuote.quoteNumber ?? latestQuote.title}</strong> - {latestQuote.status}</p><p className="text-base font-bold text-mdblue">{formatMoney(latestQuote.totalCents)}</p></div>
        {latestQuote.notes ?? latestQuote.description ? <p>{latestQuote.notes ?? latestQuote.description}</p> : null}
        <div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-2">Servico/peca</th><th>Qtd.</th><th>Valor unitario</th><th>Total</th></tr></thead><tbody>{latestQuote.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitCents)}</td><td>{formatMoney(item.quantity * item.unitCents)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-4"><span>Subtotal: <strong>{formatMoney(latestQuote.subtotalCents || latestQuote.totalCents + latestQuote.discountCents)}</strong></span><span>Desconto: <strong>{formatMoney(latestQuote.discountCents)}</strong></span><span>Validade: <strong>{latestQuote.validityDays} dias</strong></span><span>Garantia: <strong>{latestQuote.warrantyDays} dias</strong></span></div>
        <div className="flex flex-wrap gap-3">
          {latestQuote.pdfAttachment ? <a className="font-semibold text-mdblue" href={`/api/attachments/${latestQuote.pdfAttachment.id}`}>Baixar PDF do orcamento</a> : null}
          {latestQuote.attachment ? <a className="font-semibold text-mdblue" href={`/api/attachments/${latestQuote.attachment.id}`}>Baixar anexo de apoio</a> : null}
        </div>
      </div>
      {canDecideQuote ? <div className="mt-4 grid gap-3 md:grid-cols-2"><form action={approveQuoteAction} className="grid gap-2"><input type="hidden" name="quoteId" value={latestQuote.id} /><textarea name="note" placeholder="Observacao opcional" /><button className="btn">Aprovar orçamento</button></form><form action={rejectQuoteAction} className="grid gap-2"><input type="hidden" name="quoteId" value={latestQuote.id} /><textarea name="note" placeholder="Observacao opcional" /><button className="btn-secondary">Reprovar orçamento</button></form></div> : null}
    </section> : null}

    <section className="card">
      <h2 className="font-semibold">Historico de status</h2>
      <ol className="mt-4 space-y-3 text-sm">{request.statusHistory.map((item) => <li key={item.id} className="border-l-2 border-mdblue pl-3"><strong>{item.toStatus}</strong><br /><span className="text-slate-600">{item.changedBy.name} em {item.createdAt.toLocaleString('pt-BR')} {item.note ? `- ${item.note}` : ''}</span></li>)}</ol>
    </section>
  </main>;
}
