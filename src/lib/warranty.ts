'use server';

import { revalidatePath } from 'next/cache';
import { QuoteStatus, ServiceRequestStatus, WarrantyStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canManageMd } from '@/lib/rbac';
import { NotificationService } from '@/lib/services/notification';

const notifications = new NotificationService(prisma);
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function ensureWarrantyForRequest(serviceRequestId: string, changedById: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      requester: true,
      warranty: true,
      quotes: { where: { status: QuoteStatus.APROVADO }, orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }], take: 1 }
    }
  });

  if (!request || request.warranty) return null;
  if (![ServiceRequestStatus.SERVICO_CONCLUIDO, ServiceRequestStatus.FINALIZADO].includes(request.currentStatus)) return null;

  const quote = request.quotes[0];
  if (!quote) return null;

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + quote.warrantyDays);

  const warranty = await prisma.warranty.create({
    data: {
      serviceRequestId: request.id,
      quoteId: quote.id,
      companyId: request.companyId,
      requesterId: request.requesterId,
      warrantyDays: quote.warrantyDays,
      startDate,
      endDate,
      status: WarrantyStatus.ATIVA
    }
  });

  await audit(changedById, 'WARRANTY_CREATED', 'Warranty', warranty.id, { serviceRequestId: request.id, protocol: request.protocol, warrantyDays: quote.warrantyDays });

  try {
    await notifications.email({
      serviceRequestId: request.id,
      recipient: request.requester.email,
      subject: `Garantia ativada - ${request.protocol}`,
      body: [`Sua garantia foi ativada para a O.S. ${request.protocol}.`, `Prazo: ${quote.warrantyDays} dias.`, `Vencimento: ${endDate.toLocaleDateString('pt-BR')}.`].join('\n')
    });
  } catch (error) {
    console.error('[warranty] Falha ao enviar e-mail de garantia ativada', { serviceRequestId: request.id, warrantyId: warranty.id, error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }

  return warranty;
}

export async function openWarrantyClaimAction(form: FormData) {
  const user = await requireSessionUser();
  const warrantyId = text(form, 'warrantyId');
  const issueDescription = text(form, 'issueDescription');
  if (!issueDescription) throw new Error('Informe o problema apresentado.');

  const warranty = await prisma.warranty.findUniqueOrThrow({ where: { id: warrantyId }, include: { serviceRequest: true } });
  const allowed = canManageMd(user.role) || warranty.requesterId === user.id || warranty.companyId === user.companyId;
  if (!allowed) throw new Error('Acesso negado');

  const now = new Date();
  const expired = warranty.endDate < now;
  await prisma.warranty.update({
    where: { id: warrantyId },
    data: {
      status: expired ? WarrantyStatus.VENCIDA : WarrantyStatus.SOLICITACAO_ABERTA,
      issueDescription,
      openedAt: now,
      decisionNote: expired ? 'Cliente tentou abrir garantia apos o vencimento.' : null
    }
  });

  await audit(user.id, 'WARRANTY_CLAIM_OPENED', 'Warranty', warrantyId, { serviceRequestId: warranty.serviceRequestId, expired });

  if (!expired) {
    try {
      await notifications.notifyMd('Solicitacao de garantia aberta', `${warranty.serviceRequest.protocol} recebeu uma solicitacao de garantia.`, warranty.serviceRequestId);
    } catch (error) {
      console.error('[warranty] Falha ao notificar MD sobre garantia', { warrantyId, error: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  }

  revalidatePath('/dashboard');
  revalidatePath(`/requests/${warranty.serviceRequestId}`);
}

export async function updateWarrantyStatusAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');

  const warrantyId = text(form, 'warrantyId');
  const status = text(form, 'status') as WarrantyStatus;
  const decisionNote = text(form, 'decisionNote') || null;
  const warranty = await prisma.warranty.findUniqueOrThrow({ where: { id: warrantyId }, include: { serviceRequest: true, requester: true } });
  const closed = [WarrantyStatus.APROVADA, WarrantyStatus.RECUSADA, WarrantyStatus.FINALIZADA, WarrantyStatus.VENCIDA].includes(status);

  await prisma.warranty.update({
    where: { id: warrantyId },
    data: { status, decisionNote, closedAt: closed ? new Date() : null }
  });

  await audit(user.id, 'WARRANTY_STATUS_CHANGED', 'Warranty', warrantyId, { serviceRequestId: warranty.serviceRequestId, status });

  try {
    await notifications.email({
      serviceRequestId: warranty.serviceRequestId,
      recipient: warranty.requester.email,
      subject: `Garantia atualizada - ${warranty.serviceRequest.protocol}`,
      body: [`A garantia da O.S. ${warranty.serviceRequest.protocol} foi atualizada.`, `Status: ${status}.`, decisionNote ? `Observacao: ${decisionNote}` : ''].filter(Boolean).join('\n')
    });
  } catch (error) {
    console.error('[warranty] Falha ao notificar solicitante sobre garantia', { warrantyId, error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }

  revalidatePath('/dashboard');
  revalidatePath(`/requests/${warranty.serviceRequestId}`);
}
