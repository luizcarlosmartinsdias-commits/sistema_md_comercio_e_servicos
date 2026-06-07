'use server';

import { revalidatePath } from 'next/cache';
import {
  AttachmentType,
  NotificationChannel,
  QuoteStatus,
  ServiceRequestStatus,
  type Company,
  type Quote,
  type QuoteItem,
  type ServiceCatalog,
  type ServiceRequest,
  type User
} from '@prisma/client';
import type { ActionState } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { formatMoney } from '@/lib/format';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { prisma } from '@/lib/prisma';
import { canManageMd, clientRoleFilter } from '@/lib/rbac';
import { requireSessionUser } from '@/lib/session';
import { NotificationService } from '@/lib/services/notification';
import { StorageService } from '@/lib/services/storage';

type DeliveryResult = { sent: number; failed: number; totalRecipients: number; recipients: string[]; fallbackSent: number };
type QuoteWithItems = Quote & { items: QuoteItem[]; serviceRequest: ServiceRequest & { company: Company; requester: User }; pdfAttachment?: { id: string } | null };
type SelectedQuoteItem = { service: ServiceCatalog; quantity: number; unitCents: number };

const notifications = new NotificationService(prisma);
const appUrl = () => (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function createQuoteWithFeedbackAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const requestId = text(form, 'requestId');

  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    await createQuoteRecord(form, user.id);
    const delivery = await ensureQuoteEmailDelivery(requestId, user.id);
    return deliveryState('Orçamento gerado', delivery);
  } catch (error) {
    console.error('[quote] Falha ao gerar orçamento', { requestId, error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível gerar o orçamento. Verifique os dados e tente novamente.' };
  }
}

export async function resendLatestQuotePdfAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const requestId = text(form, 'requestId');

  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    const quote = await findLatestQuote(requestId);
    const recipients = await quoteRecipients(quote);
    const delivery = await sendQuotePdfEmail(quote, recipients, user.id, 'PDF do orçamento reenviado por e-mail.');
    revalidatePath(`/requests/${requestId}`);
    return deliveryState('PDF reenviado', delivery);
  } catch (error) {
    console.error('[quote] Falha ao reenviar PDF do orçamento', { requestId, error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível reenviar o PDF do orçamento. Verifique os logs da Vercel e tente novamente.' };
  }
}

async function createQuoteRecord(form: FormData, userId: string) {
  const requestId = text(form, 'requestId');
  const current = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { company: true, requester: true } });
  const selectedIds = form.getAll('serviceCatalogId').map((value) => String(value)).filter(Boolean);
  if (selectedIds.length === 0) throw new Error('Selecione pelo menos um serviço para criar o orçamento.');

  const services = await prisma.serviceCatalog.findMany({ where: { id: { in: selectedIds }, active: true } });
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const items = selectedIds.map((serviceId) => {
    const service = serviceById.get(serviceId);
    if (!service) return null;
    const quantity = Math.max(1, Number(text(form, `quantity-${serviceId}`) || '1'));
    const unitCents = moneyToCents(text(form, `unitValue-${serviceId}`)) || service.defaultUnitCents;
    return { service, quantity, unitCents };
  }).filter((item): item is SelectedQuoteItem => Boolean(item));

  if (items.length === 0) throw new Error('Nenhum serviço ativo foi encontrado para o orçamento.');

  const subtotalCents = items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
  const discountCents = Math.min(subtotalCents, Math.max(0, moneyToCents(text(form, 'discountValue'))));
  const totalCents = subtotalCents - discountCents;
  const notes = text(form, 'notes');
  const validityDays = positiveInt(text(form, 'validityDays'), 7);
  const warrantyDays = positiveInt(text(form, 'warrantyDays'), 90);
  const executionDeadlineDays = positiveInt(text(form, 'executionDeadlineDays'), 5);
  let supportAttachmentId: string | undefined;
  const file = form.get('file');
  if (file instanceof File && file.size > 0) supportAttachmentId = (await saveAttachment(requestId, userId, file, AttachmentType.OUTRO)).id;

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
      attachmentId: supportAttachmentId,
      items: { create: items.map(({ service, quantity, unitCents }) => ({ serviceCatalogId: service.id, description: `${service.name}: ${service.description}`, quantity, unitCents })) }
    },
    include: { items: true }
  });

  const pdfBytes = await generateQuotePdf({ quote, request: current, portalUrl: `${appUrl()}/requests/${requestId}` });
  const pdfFileName = `${quote.quoteNumber ?? quote.id}.pdf`;
  const storedPdf = await StorageService.saveBytes(pdfBytes, requestId, pdfFileName, 'application/pdf');
  const pdfAttachment = await prisma.attachment.create({ data: { serviceRequestId: requestId, uploadedById: userId, type: AttachmentType.ORCAMENTO, ...storedPdf } });

  await prisma.quote.update({ where: { id: quote.id }, data: { pdfAttachmentId: pdfAttachment.id } });
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      currentStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO,
      statusHistory: { create: { fromStatus: current.currentStatus, toStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, changedById: userId, note: `Orçamento criado: ${quote.quoteNumber}` } }
    }
  });
  await audit(userId, 'QUOTE_CREATED', 'Quote', quote.id, { quoteNumber: quote.quoteNumber, subtotalCents, discountCents, totalCents, emailDeferred: true });
  revalidatePath(`/requests/${requestId}`);
}

async function ensureQuoteEmailDelivery(requestId: string, changedById: string): Promise<DeliveryResult> {
  const quote = await findLatestQuote(requestId);
  const expectedRecipients = await quoteRecipients(quote);
  if (expectedRecipients.length === 0) return { sent: 0, failed: 0, totalRecipients: 0, recipients: [], fallbackSent: 0 };

  const logs = await prisma.notificationLog.findMany({
    where: {
      serviceRequestId: requestId,
      channel: NotificationChannel.EMAIL,
      createdAt: { gte: quote.createdAt },
      subject: { contains: quote.serviceRequest.protocol }
    },
    orderBy: { createdAt: 'desc' }
  });

  const deliveredRecipients = new Set(
    logs
      .filter((log) => log.status === 'SENT' || log.status === 'MOCKED')
      .map((log) => normalizeEmail(log.recipient))
      .filter(Boolean)
  );
  const loggedRecipients = new Set(logs.map((log) => normalizeEmail(log.recipient)).filter(Boolean));
  const neverAttemptedRecipients = expectedRecipients.filter((recipient) => !loggedRecipients.has(normalizeEmail(recipient)));

  if (neverAttemptedRecipients.length === 0) {
    return {
      sent: deliveredRecipients.size,
      failed: logs.filter((log) => log.status === 'FAILED').length,
      totalRecipients: expectedRecipients.length,
      recipients: expectedRecipients,
      fallbackSent: 0
    };
  }

  console.info('[quote] Envio do PDF do orçamento', {
    requestId,
    quoteId: quote.id,
    expectedRecipients: expectedRecipients.length,
    recipientsToSend: neverAttemptedRecipients.length
  });

  const delivery = await sendQuotePdfEmail(quote, neverAttemptedRecipients, changedById, `PDF do orçamento enviado por e-mail para ${neverAttemptedRecipients.length} destinatário(s).`);
  return {
    sent: deliveredRecipients.size + delivery.sent,
    failed: logs.filter((log) => log.status === 'FAILED').length + delivery.failed,
    totalRecipients: expectedRecipients.length,
    recipients: expectedRecipients,
    fallbackSent: delivery.fallbackSent
  };
}

async function findLatestQuote(requestId: string) {
  const quote = await prisma.quote.findFirst({
    where: { serviceRequestId: requestId },
    include: { items: true, pdfAttachment: true, serviceRequest: { include: { company: true, requester: true } } },
    orderBy: { createdAt: 'desc' }
  });

  if (!quote) throw new Error('Nenhum orçamento encontrado para esta solicitação.');
  return quote;
}

async function quoteRecipients(quote: QuoteWithItems) {
  const clients = await prisma.user.findMany({
    where: { companyId: quote.serviceRequest.companyId, role: clientRoleFilter(), active: true },
    select: { email: true }
  });

  return uniqueEmails([
    ...clients.map((client) => client.email),
    quote.serviceRequest.company.email,
    quote.serviceRequest.requester.email
  ]);
}

async function sendQuotePdfEmail(quote: QuoteWithItems, recipients: string[], changedById: string, historyNote: string): Promise<DeliveryResult> {
  if (recipients.length === 0) return { sent: 0, failed: 0, totalRecipients: 0, recipients: [], fallbackSent: 0 };

  const request = quote.serviceRequest;
  const requestUrl = `${appUrl()}/requests/${request.id}`;
  const pdfUrl = quote.pdfAttachment ? `${appUrl()}/api/attachments/${quote.pdfAttachment.id}` : requestUrl;
  const pdfBytes = await generateQuotePdf({ quote, request, portalUrl: requestUrl });
  const subject = `Orçamento disponível para aprovação - ${request.protocol}`;
  const body = [
    `Protocolo: ${request.protocol}`,
    `Empresa: ${request.company.name}`,
    `Aparelho: ${request.tipoAparelho} ${request.marca} ${request.modelo}`,
    `Valor total: ${formatMoney(quote.totalCents)}`,
    `Acesse o portal para aprovar ou reprovar: ${requestUrl}`,
    `Link direto para baixar o PDF: ${pdfUrl}`,
    'O PDF padronizado do orçamento está anexado a este e-mail.'
  ].join('\n');
  const fallbackBody = [
    `Protocolo: ${request.protocol}`,
    `Empresa: ${request.company.name}`,
    `Aparelho: ${request.tipoAparelho} ${request.marca} ${request.modelo}`,
    `Valor total: ${formatMoney(quote.totalCents)}`,
    `Acesse o portal para aprovar ou reprovar: ${requestUrl}`,
    `Baixe o PDF do orçamento neste link: ${pdfUrl}`,
    'O envio com anexo falhou, por isso este e-mail foi enviado com o link do PDF.'
  ].join('\n');
  const attachment = { filename: `${quote.quoteNumber ?? quote.id}.pdf`, content: Buffer.from(pdfBytes).toString('base64') };

  const results = await Promise.all(recipients.map(async (recipient) => {
    try {
      await notifications.email({ serviceRequestId: request.id, recipient, subject, body, attachments: [attachment] });
      return { recipient, sent: true, fallback: false };
    } catch (error) {
      console.error('[quote] Falha ao enviar PDF anexado do orçamento', { requestId: request.id, quoteId: quote.id, recipient, error: errorMessage(error) });
      try {
        await notifications.email({ serviceRequestId: request.id, recipient, subject: `${subject} - link do PDF`, body: fallbackBody });
        return { recipient, sent: true, fallback: true };
      } catch (fallbackError) {
        console.error('[quote] Falha ao enviar fallback sem anexo do orçamento', { requestId: request.id, quoteId: quote.id, recipient, error: errorMessage(fallbackError) });
        return { recipient, sent: false, fallback: false };
      }
    }
  }));

  const sent = results.filter((result) => result.sent).length;
  const failed = results.length - sent;
  const fallbackSent = results.filter((result) => result.fallback).length;

  await prisma.serviceRequestStatusHistory.create({
    data: {
      serviceRequestId: request.id,
      fromStatus: request.currentStatus,
      toStatus: request.currentStatus,
      changedById,
      note: sent > 0 ? (fallbackSent > 0 ? `Orçamento enviado por e-mail para ${sent} destinatário(s); ${fallbackSent} sem anexo, com link do PDF.` : historyNote) : 'Orçamento criado, mas o envio do PDF por e-mail falhou.'
    }
  });

  return { sent, failed, totalRecipients: recipients.length, recipients, fallbackSent };
}

async function saveAttachment(requestId: string, userId: string, file: File, type: AttachmentType) {
  const stored = await StorageService.save(file, requestId);
  return prisma.attachment.create({ data: { serviceRequestId: requestId, uploadedById: userId, type, ...stored } });
}

function deliveryState(prefix: string, delivery: DeliveryResult): ActionState {
  if (delivery.totalRecipients === 0) {
    return { status: 'warning', message: `${prefix}, mas não há destinatário com e-mail cadastrado. Cadastre e-mail na empresa ou ative um cliente com e-mail.` };
  }
  if (delivery.sent > 0 && delivery.failed === 0 && delivery.fallbackSent === 0) return { status: 'success', message: `${prefix} e enviado com PDF anexado para ${delivery.sent} destinatário(s).` };
  if (delivery.sent > 0 && delivery.failed === 0) return { status: 'warning', message: `${prefix}. E-mail enviado para ${delivery.sent} destinatário(s), mas ${delivery.fallbackSent} receberam link do PDF sem anexo.` };
  if (delivery.sent > 0) return { status: 'warning', message: `${prefix}. Enviado para ${delivery.sent} destinatário(s), com falha para ${delivery.failed}.` };
  return { status: 'warning', message: `${prefix}, mas o e-mail não foi enviado. Veja os logs de notificação na ordem de serviço.` };
}

function moneyToCents(value: string) {
  const clean = value.replace(/[^0-9,.-]/g, '').trim();
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function positiveInt(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function nextQuoteNumber(protocol: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  return `ORC-${protocol}-${stamp}`;
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeEmail).filter(Boolean)));
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
