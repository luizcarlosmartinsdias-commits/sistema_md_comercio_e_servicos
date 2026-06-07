'use server';

import { revalidatePath } from 'next/cache';
import { NotificationChannel, type Company, type Quote, type QuoteItem, type ServiceRequest, type User } from '@prisma/client';
import type { ActionState } from '@/lib/actions';
import { createQuoteAction } from '@/lib/actions';
import { formatMoney } from '@/lib/format';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { prisma } from '@/lib/prisma';
import { canManageMd, clientRoleFilter } from '@/lib/rbac';
import { requireSessionUser } from '@/lib/session';
import { NotificationService } from '@/lib/services/notification';

type DeliveryResult = { sent: number; failed: number; totalRecipients: number; recipients: string[] };
type QuoteWithItems = Quote & { items: QuoteItem[]; serviceRequest: ServiceRequest & { company: Company; requester: User } };

const notifications = new NotificationService(prisma);
const appUrl = () => (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export async function createQuoteWithFeedbackAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const requestId = String(form.get('requestId') ?? '').trim();

  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    await createQuoteAction(form);
    const delivery = await ensureQuoteEmailDelivery(requestId, user.id);
    return deliveryState('Orçamento gerado', delivery);
  } catch (error) {
    console.error('[quote] Falha ao gerar ou enviar orçamento', { requestId, error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível gerar e enviar o orçamento. Verifique os dados e tente novamente.' };
  }
}

export async function resendLatestQuotePdfAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const requestId = String(form.get('requestId') ?? '').trim();

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

async function ensureQuoteEmailDelivery(requestId: string, changedById: string): Promise<DeliveryResult> {
  const quote = await findLatestQuote(requestId);
  const expectedRecipients = await quoteRecipients(quote);
  if (expectedRecipients.length === 0) return { sent: 0, failed: 0, totalRecipients: 0, recipients: [] };

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
  const missingRecipients = expectedRecipients.filter((recipient) => !deliveredRecipients.has(normalizeEmail(recipient)));

  if (missingRecipients.length === 0) {
    return {
      sent: expectedRecipients.length,
      failed: logs.filter((log) => log.status === 'FAILED').length,
      totalRecipients: expectedRecipients.length,
      recipients: expectedRecipients
    };
  }

  console.info('[quote] Envio complementar do PDF do orçamento', {
    requestId,
    quoteId: quote.id,
    expectedRecipients: expectedRecipients.length,
    missingRecipients: missingRecipients.length
  });

  return sendQuotePdfEmail(quote, missingRecipients, changedById, `PDF do orçamento enviado por e-mail para ${missingRecipients.length} destinatário(s).`);
}

async function findLatestQuote(requestId: string) {
  const quote = await prisma.quote.findFirst({
    where: { serviceRequestId: requestId },
    include: { items: true, serviceRequest: { include: { company: true, requester: true } } },
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
  if (recipients.length === 0) return { sent: 0, failed: 0, totalRecipients: 0, recipients: [] };

  const request = quote.serviceRequest;
  const pdfBytes = await generateQuotePdf({ quote, request, portalUrl: `${appUrl()}/requests/${request.id}` });
  const subject = `Orçamento disponível para aprovação - ${request.protocol}`;
  const body = [
    `Protocolo: ${request.protocol}`,
    `Empresa: ${request.company.name}`,
    `Aparelho: ${request.tipoAparelho} ${request.marca} ${request.modelo}`,
    `Valor total: ${formatMoney(quote.totalCents)}`,
    `Acesse o portal para aprovar ou reprovar: ${appUrl()}/requests/${request.id}`,
    'O PDF padronizado do orçamento está anexado a este e-mail.'
  ].join('\n');
  const attachment = { filename: `${quote.quoteNumber ?? quote.id}.pdf`, content: Buffer.from(pdfBytes).toString('base64') };

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await notifications.email({ serviceRequestId: request.id, recipient, subject, body, attachments: [attachment] });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error('[quote] Falha ao enviar PDF do orçamento', { requestId: request.id, quoteId: quote.id, recipient, error: errorMessage(error) });
    }
  }

  if (sent > 0) {
    await prisma.serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: request.id,
        fromStatus: request.currentStatus,
        toStatus: request.currentStatus,
        changedById,
        note: historyNote
      }
    });
  }

  return { sent, failed, totalRecipients: recipients.length, recipients };
}

function deliveryState(prefix: string, delivery: DeliveryResult): ActionState {
  if (delivery.totalRecipients === 0) {
    return { status: 'warning', message: `${prefix}, mas não há destinatário com e-mail cadastrado. Cadastre e-mail na empresa ou ative um cliente com e-mail.` };
  }
  if (delivery.sent > 0 && delivery.failed === 0) return { status: 'success', message: `${prefix} e enviado para ${delivery.sent} destinatário(s).` };
  if (delivery.sent > 0) return { status: 'warning', message: `${prefix}. Enviado para ${delivery.sent} destinatário(s), com falha para ${delivery.failed}.` };
  return { status: 'error', message: `${prefix}, mas o e-mail não foi enviado. Verifique RESEND_API_KEY, EMAIL_FROM e o domínio remetente no Resend.` };
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
