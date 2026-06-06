'use server';

import { readFile } from 'fs/promises';
import { NotificationChannel } from '@prisma/client';
import type { ActionState } from '@/lib/actions';
import { createQuoteAction } from '@/lib/actions';
import { formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/services/notification';
import { StorageService } from '@/lib/services/storage';

type DeliveryResult = { sent: number; failed: number; totalRecipients: number; recipients: string[] };

const notifications = new NotificationService(prisma);
const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export async function createQuoteWithFeedbackAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const requestId = String(form.get('requestId') ?? '').trim();
  const startedAt = new Date();

  try {
    await createQuoteAction(form);
    const delivery = await ensureQuoteEmailDelivery(requestId, startedAt);

    if (delivery.totalRecipients === 0) return { status: 'warning', message: 'Orçamento gerado, mas não há destinatário com e-mail cadastrado para esta empresa.' };
    if (delivery.sent > 0 && delivery.failed === 0) return { status: 'success', message: `Orçamento gerado e enviado para ${delivery.sent} destinatário(s).` };
    if (delivery.sent > 0) return { status: 'warning', message: `Orçamento gerado. Enviado para ${delivery.sent} destinatário(s), com falha para ${delivery.failed}.` };
    return { status: 'warning', message: 'Orçamento gerado, mas houve falha no envio do e-mail.' };
  } catch (error) {
    console.error('[quote] Falha ao gerar ou enviar orçamento', { requestId, error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível gerar e enviar o orçamento. Verifique os dados e tente novamente.' };
  }
}

async function ensureQuoteEmailDelivery(requestId: string, startedAt: Date): Promise<DeliveryResult> {
  const logs = await prisma.notificationLog.findMany({
    where: { serviceRequestId: requestId, channel: NotificationChannel.EMAIL, createdAt: { gte: startedAt } }
  });

  if (logs.length > 0) {
    const sent = logs.filter((log) => log.status === 'SENT' || log.status === 'MOCKED').length;
    const failed = logs.filter((log) => log.status === 'FAILED').length;
    return { sent, failed, totalRecipients: logs.length, recipients: logs.map((log) => log.recipient) };
  }

  const quote = await prisma.quote.findFirst({
    where: { serviceRequestId: requestId },
    include: { pdfAttachment: true, serviceRequest: { include: { company: true, requester: true } } },
    orderBy: { createdAt: 'desc' }
  });

  if (!quote?.pdfAttachment) return { sent: 0, failed: 1, totalRecipients: 1, recipients: [] };

  const recipients = uniqueEmails([quote.serviceRequest.company.email, quote.serviceRequest.requester.email]);
  if (recipients.length === 0) return { sent: 0, failed: 0, totalRecipients: 0, recipients: [] };

  const pdfBytes = await readFile(StorageService.resolveLocalPath(quote.pdfAttachment.storageKey));
  const subject = `Orçamento disponível para aprovação - ${quote.serviceRequest.protocol}`;
  const body = [
    `Protocolo: ${quote.serviceRequest.protocol}`,
    `Empresa: ${quote.serviceRequest.company.name}`,
    `Aparelho: ${quote.serviceRequest.tipoAparelho} ${quote.serviceRequest.marca} ${quote.serviceRequest.modelo}`,
    `Valor total: ${formatMoney(quote.totalCents)}`,
    `Acesse o portal para aprovar ou reprovar: ${appUrl()}/requests/${quote.serviceRequest.id}`,
    'O PDF padronizado do orçamento está anexado a este e-mail.'
  ].join('\n');
  const attachment = { filename: quote.pdfAttachment.fileName, content: pdfBytes.toString('base64') };

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await notifications.email({ serviceRequestId: requestId, recipient, subject, body, attachments: [attachment] });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error('[quote] Falha ao enviar PDF do orçamento para destinatário alternativo', { requestId, quoteId: quote.id, recipient, error: errorMessage(error) });
    }
  }

  if (sent > 0) {
    await prisma.serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: requestId,
        fromStatus: quote.serviceRequest.currentStatus,
        toStatus: quote.serviceRequest.currentStatus,
        changedById: quote.serviceRequest.requesterId,
        note: `PDF do orçamento enviado para ${sent} destinatário(s) alternativo(s).`
      }
    });
  }

  return { sent, failed, totalRecipients: recipients.length, recipients };
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter((value) => value.includes('@'))));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
