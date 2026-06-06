import { AttachmentType, ServiceRequestStatus } from '@prisma/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { QuoteForm } from '@/components/quote-form';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { canApproveQuote, canManageMd, canRequestInvoice } from '@/lib/rbac';
import { approveQuoteAction, rejectQuoteAction, requestInvoiceAction, updateStatusAction, uploadAttachmentAction } from '@/lib/actions';
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
        <div><dt className="font-semibold">Responsável</dt><dd>{request.responsavel}</dd></div>
        <div><dt className="font-semibold">Telefone</dt><dd>{request.telefone}</dd></div>
        <div><dt className="font-semibold">Serial/IMEI</dt><dd>{request.serial}</dd></div>
        <div className="md:col-span-3"><dt className="font-semibold">Problema</dt><dd>{request.problema}</dd></div>
      </dl>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      {mdUser ? <div className="card">
        <h2 className="font-semibold">Operação MD</h2>
        <form action={updateStatusAction} className="mt-4 grid gap-3">
          <input type="hidden" name="requestId" value={request.id} />
          <select name="status" defaultValue={request.currentStatus}>{Object.values(ServiceRequestStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <input name="note" placeholder="Observação do status" />
          <button className="btn">Alterar status</button>
        </form>

        <QuoteForm requestId={request.id} services={serviceCatalog.map((service) => ({ id: service.id, name: service.name, description: service.description, category: service.category, defaultUnitCents: service.defaultUnitCents }))} />
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
      <h2 className="font-semibold">Orçamento</h2>
      <div className="mt-3 space-y-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2"><p><strong>{latestQuote.quoteNumber ?? latestQuote.title}</strong> - {latestQuote.status}</p><p className="text-base font-bold text-mdblue">{formatMoney(latestQuote.totalCents)}</p></div>
        {latestQuote.notes ?? latestQuote.description ? <p>{latestQuote.notes ?? latestQuote.description}</p> : null}
        <div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-2">Serviço/peça</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead><tbody>{latestQuote.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-2">{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitCents)}</td><td>{formatMoney(item.quantity * item.unitCents)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-4"><span>Subtotal: <strong>{formatMoney(latestQuote.subtotalCents || latestQuote.totalCents + latestQuote.discountCents)}</strong></span><span>Desconto: <strong>{formatMoney(latestQuote.discountCents)}</strong></span><span>Validade: <strong>{latestQuote.validityDays} dias</strong></span><span>Garantia: <strong>{latestQuote.warrantyDays} dias</strong></span></div>
        <div className="flex flex-wrap gap-3">
          {latestQuote.pdfAttachment ? <a className="font-semibold text-mdblue" href={`/api/attachments/${latestQuote.pdfAttachment.id}`}>Baixar PDF do orçamento</a> : null}
          {latestQuote.attachment ? <a className="font-semibold text-mdblue" href={`/api/attachments/${latestQuote.attachment.id}`}>Baixar anexo de apoio</a> : null}
        </div>
      </div>
      {canDecideQuote ? <div className="mt-4 grid gap-3 md:grid-cols-2"><form action={approveQuoteAction} className="grid gap-2"><input type="hidden" name="quoteId" value={latestQuote.id} /><textarea name="note" placeholder="Observação opcional" /><button className="btn">Aprovar orçamento</button></form><form action={rejectQuoteAction} className="grid gap-2"><input type="hidden" name="quoteId" value={latestQuote.id} /><textarea name="note" placeholder="Observação opcional" /><button className="btn-secondary">Reprovar orçamento</button></form></div> : null}
    </section> : null}

    <section className="card">
      <h2 className="font-semibold">Histórico de status</h2>
      <ol className="mt-4 space-y-3 text-sm">{request.statusHistory.map((item) => <li key={item.id} className="border-l-2 border-mdblue pl-3"><strong>{item.toStatus}</strong><br /><span className="text-slate-600">{item.changedBy.name} em {item.createdAt.toLocaleString('pt-BR')} {item.note ? `- ${item.note}` : ''}</span></li>)}</ol>
    </section>
  </main>;
}
