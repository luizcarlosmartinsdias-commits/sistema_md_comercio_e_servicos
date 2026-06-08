import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AttachmentType, QuoteStatus, ServiceRequestStatus, type ServiceCatalog } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formatMoney } from '@/lib/format';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { prisma } from '@/lib/prisma';
import { canManageMd, clientRoleFilter } from '@/lib/rbac';
import { NotificationService } from '@/lib/services/notification';
import { StorageService } from '@/lib/services/storage';

type QuoteItemInput = { serviceCatalogId: string; quantity: number; unitValue: string };
type CreateQuoteInput = {
  requestId?: string;
  services?: QuoteItemInput[];
  discountValue?: string;
  validityDays?: number;
  executionDeadlineDays?: number;
  warrantyDays?: number;
  notes?: string;
};
type SelectedQuoteItem = { service: ServiceCatalog; quantity: number; unitCents: number };

const notifications = new NotificationService(prisma);
const appUrl = () => (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export async function POST(request: Request) {
  let requestId = '';
  let quoteId: string | undefined;

  try {
    console.info('[quote-api]', { etapa: 'submit_form' });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return jsonError('Sessão expirada. Faça login novamente.', 401);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.active || !canManageMd(user.role)) return jsonError('Acesso negado.', 403);

    const input = await request.json() as CreateQuoteInput;
    requestId = String(input.requestId ?? '').trim();
    const receivedServices = Array.isArray(input.services) ? input.services : [];
    const serviceIds = receivedServices.map((service) => String(service.serviceCatalogId ?? '').trim()).filter(Boolean);

    console.info('[quote-api]', {
      etapa: 'parse_form',
      requestId,
      serviceIds,
      quantities: receivedServices.map((service) => service.quantity),
      unitValues: receivedServices.map((service) => service.unitValue)
    });

    if (!requestId) return jsonError('Solicitação inválida.', 400);
    if (serviceIds.length === 0) return jsonError('Selecione pelo menos um serviço.', 400);

    const current = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { company: true, requester: true } });
    const services = await prisma.serviceCatalog.findMany({ where: { id: { in: serviceIds }, active: true } });
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const items = receivedServices.map((item) => {
      const serviceId = String(item.serviceCatalogId ?? '').trim();
      const service = serviceById.get(serviceId);
      if (!service) return null;
      const quantity = Math.max(1, Number(item.quantity || 1));
      const unitCents = moneyToCents(String(item.unitValue ?? '')) || service.defaultUnitCents;
      return { service, quantity, unitCents };
    }).filter((item): item is SelectedQuoteItem => Boolean(item));

    if (items.length === 0) return jsonError('Selecione pelo menos um serviço.', 400);

    const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
    const discountCents = Math.min(subtotalCents, Math.max(0, moneyToCents(String(input.discountValue ?? ''))));
    const totalCents = subtotalCents - discountCents;
    const notes = String(input.notes ?? '').trim();
    const validityDays = positiveInt(input.validityDays, 7);
    const warrantyDays = positiveInt(input.warrantyDays, 90);
    const executionDeadlineDays = positiveInt(input.executionDeadlineDays, 5);

    console.info('[quote-api]', { etapa: 'create_quote', requestId, serviceIds, totalCents });
    const quote = await prisma.quote.create({
      data: {
        serviceRequestId: requestId,
        quoteNumber: nextQuoteNumber(current.protocol),
        title: `Orçamento ${current.protocol}`,
        description: notes || null,
        status: QuoteStatus.ENVIADO,
        subtotalCents,
        discountCents,
        totalCents,
        validityDays,
        warrantyDays,
        executionDeadlineDays,
        notes: notes || null,
        items: { create: items.map(({ service, quantity, unitCents }) => ({ serviceCatalogId: service.id, description: `${service.name}: ${service.description}`, quantity, unitCents })) }
      },
      include: { items: true }
    });
    quoteId = quote.id;

    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        currentStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO,
        statusHistory: { create: { fromStatus: current.currentStatus, toStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, changedById: user.id, note: `Orçamento criado: ${quote.quoteNumber}` } }
      }
    });
    await audit(user.id, 'QUOTE_CREATED', 'Quote', quote.id, { quoteNumber: quote.quoteNumber, subtotalCents, discountCents, totalCents });

    try {
      console.info('[quote-api]', { etapa: 'generate_pdf', requestId, quoteId });
      const pdfBytes = await withTimeout(generateQuotePdf({ quote, request: current, portalUrl: `${appUrl()}/requests/${requestId}` }), 10000, 'Tempo limite ao gerar PDF.');
      const pdfFileName = `${quote.quoteNumber ?? quote.id}.pdf`;
      const storedPdf = await StorageService.saveBytes(pdfBytes, requestId, pdfFileName, 'application/pdf');
      const pdfAttachment = await prisma.attachment.create({ data: { serviceRequestId: requestId, uploadedById: user.id, type: AttachmentType.ORCAMENTO, ...storedPdf } });
      await prisma.quote.update({ where: { id: quote.id }, data: { pdfAttachmentId: pdfAttachment.id } });

      const delivery = await withTimeout(sendQuoteEmail({ request: current, quote: { ...quote, pdfAttachment }, pdfBytes }), 10000, 'Tempo limite ao enviar e-mail do orçamento.');
      if (delivery.sent > 0 && delivery.failed === 0 && delivery.fallbackSent === 0) {
        return NextResponse.json({ status: 'success', message: 'Orçamento criado e enviado ao cliente por e-mail.', quoteId: quote.id });
      }
      if (delivery.sent > 0) {
        return NextResponse.json({ status: 'warning', message: 'Orçamento criado, mas o e-mail foi enviado com aviso. Confira os logs de notificação.', quoteId: quote.id });
      }
      return NextResponse.json({ status: 'warning', message: 'Orçamento criado, mas não foi possível gerar/enviar o PDF.', quoteId: quote.id });
    } catch (error) {
      console.error('[quote-api]', { etapa: 'generate_pdf', requestId, quoteId, error: errorMessage(error) });
      await prisma.serviceRequestStatusHistory.create({ data: { serviceRequestId: requestId, fromStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, toStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, changedById: user.id, note: 'Orçamento criado, mas houve falha ao gerar/enviar o PDF.' } });
      return NextResponse.json({ status: 'warning', message: 'Orçamento criado, mas não foi possível gerar/enviar o PDF.', quoteId: quote.id });
    }
  } catch (error) {
    console.error('[quote-api]', { etapa: quoteId ? 'unexpected_after_quote' : 'create_quote', requestId, quoteId, error: errorMessage(error) });
    return jsonError('Não foi possível criar o orçamento. Tente novamente.', 500);
  }
}

async function sendQuoteEmail({ request, quote, pdfBytes }: { request: Awaited<ReturnType<typeof prisma.serviceRequest.findUniqueOrThrow>> & { company: { email: string | null; name: string }; requester: { email: string } }; quote: { id: string; quoteNumber: string | null; totalCents: number; pdfAttachment?: { id: string } | null }; pdfBytes: Uint8Array }) {
  console.info('[quote-api]', { etapa: 'send_email', requestId: request.id, quoteId: quote.id });
  const clients = await prisma.user.findMany({ where: { companyId: request.companyId, role: clientRoleFilter(), active: true }, select: { email: true } });
  const recipients = uniqueEmails([...clients.map((client) => client.email), request.company.email, request.requester.email]);
  if (recipients.length === 0) return { sent: 0, failed: 0, fallbackSent: 0 };

  const requestUrl = `${appUrl()}/requests/${request.id}`;
  const pdfUrl = quote.pdfAttachment ? `${appUrl()}/api/attachments/${quote.pdfAttachment.id}` : requestUrl;
  const subject = `Orçamento disponível para aprovação - ${request.protocol}`;
  const body = [`Protocolo: ${request.protocol}`, `Empresa: ${request.company.name}`, `Aparelho: ${request.tipoAparelho} ${request.marca} ${request.modelo}`, `Valor total: ${formatMoney(quote.totalCents)}`, `Acesse o portal para aprovar ou reprovar: ${requestUrl}`, `Link direto para baixar o PDF: ${pdfUrl}`, 'O PDF padronizado do orçamento está anexado a este e-mail.'].join('\n');
  const fallbackBody = [`Protocolo: ${request.protocol}`, `Empresa: ${request.company.name}`, `Aparelho: ${request.tipoAparelho} ${request.marca} ${request.modelo}`, `Valor total: ${formatMoney(quote.totalCents)}`, `Acesse o portal para aprovar ou reprovar: ${requestUrl}`, `Baixe o PDF do orçamento neste link: ${pdfUrl}`, 'O envio com anexo falhou, por isso este e-mail foi enviado com o link do PDF.'].join('\n');
  const attachment = { filename: `${quote.quoteNumber ?? quote.id}.pdf`, content: Buffer.from(pdfBytes).toString('base64') };

  const results = await Promise.all(recipients.map(async (recipient) => {
    try {
      await notifications.email({ serviceRequestId: request.id, recipient, subject, body, attachments: [attachment] });
      return { sent: true, fallback: false };
    } catch (error) {
      console.error('[quote-api]', { etapa: 'send_email', requestId: request.id, quoteId: quote.id, recipient, error: errorMessage(error) });
      try {
        await notifications.email({ serviceRequestId: request.id, recipient, subject: `${subject} - link do PDF`, body: fallbackBody });
        return { sent: true, fallback: true };
      } catch (fallbackError) {
        console.error('[quote-api]', { etapa: 'send_email', requestId: request.id, quoteId: quote.id, recipient, error: errorMessage(fallbackError) });
        return { sent: false, fallback: false };
      }
    }
  }));

  const sent = results.filter((result) => result.sent).length;
  const failed = results.length - sent;
  const fallbackSent = results.filter((result) => result.fallback).length;
  await prisma.serviceRequestStatusHistory.create({ data: { serviceRequestId: request.id, fromStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, toStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, changedById: request.requesterId, note: sent > 0 ? `Orçamento enviado por e-mail para ${sent} destinatário(s).` : 'Orçamento criado, mas o envio do PDF por e-mail falhou.' } });
  return { sent, failed, fallbackSent };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: 'error', message }, { status });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function moneyToCents(value: string) {
  const clean = value.replace(/[^0-9,.-]/g, '').trim();
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function positiveInt(value: number | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function nextQuoteNumber(protocol: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  return `ORC-${protocol}-${stamp}`;
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter((value) => value.includes('@'))));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
