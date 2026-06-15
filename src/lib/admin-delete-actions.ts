'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canManageMd, isClient } from '@/lib/rbac';
import type { ActionState } from '@/lib/actions';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
type Tx = Prisma.TransactionClient;

export async function deleteClientPermanentlyAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const admin = await requireSessionUser();
    if (!canManageMd(admin.role)) return { status: 'error', message: 'Acesso negado.' };

    const clientId = text(form, 'clientId');
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client || !isClient(client.role)) return { status: 'error', message: 'Cliente nao encontrado.' };

    await prisma.$transaction(async (tx) => {
      await deleteRequests(tx, { requesterId: clientId });
      await detachAndDeleteAttachmentsByUploader(tx, clientId);
      await tx.serviceRequestStatusHistory.deleteMany({ where: { changedById: clientId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: clientId } });
      await tx.auditLog.deleteMany({ where: { userId: clientId } });
      await tx.user.delete({ where: { id: clientId } });
    });

    await audit(admin.id, 'CLIENT_PERMANENTLY_DELETED', 'User', clientId, { email: client.email });
    revalidatePath('/dashboard');
    return { status: 'success', message: 'Cliente excluido definitivamente.' };
  } catch (error) {
    console.error('[client] Falha ao excluir definitivamente', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return { status: 'error', message: 'Nao foi possivel excluir definitivamente o cliente.' };
  }
}

export async function deleteCompanyPermanentlyAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const admin = await requireSessionUser();
    if (!canManageMd(admin.role)) return { status: 'error', message: 'Acesso negado.' };

    const companyId = text(form, 'companyId');
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { status: 'error', message: 'Empresa nao encontrada.' };

    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({ where: { companyId }, select: { id: true } });
      const userIds = users.map((user) => user.id);

      await deleteRequests(tx, { companyId });
      await tx.invitationToken.deleteMany({ where: { companyId } });

      for (const userId of userIds) {
        await detachAndDeleteAttachmentsByUploader(tx, userId);
      }

      if (userIds.length > 0) {
        await tx.serviceRequestStatusHistory.deleteMany({ where: { changedById: { in: userIds } } });
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
        await tx.auditLog.deleteMany({ where: { userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      await tx.company.delete({ where: { id: companyId } });
    });

    await audit(admin.id, 'COMPANY_PERMANENTLY_DELETED', 'Company', companyId, { name: company.name });
    revalidatePath('/dashboard');
    return { status: 'success', message: 'Empresa excluida definitivamente.' };
  } catch (error) {
    console.error('[company] Falha ao excluir definitivamente', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return { status: 'error', message: 'Nao foi possivel excluir definitivamente a empresa.' };
  }
}

async function deleteRequests(tx: Tx, where: Prisma.ServiceRequestWhereInput) {
  const requests = await tx.serviceRequest.findMany({ where, select: { id: true } });
  const requestIds = requests.map((request) => request.id);
  if (requestIds.length === 0) return;

  const quotes = await tx.quote.findMany({ where: { serviceRequestId: { in: requestIds } }, select: { id: true } });
  const quoteIds = quotes.map((quote) => quote.id);

  if (quoteIds.length > 0) {
    await tx.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await tx.quote.deleteMany({ where: { id: { in: quoteIds } } });
  }

  await tx.notificationLog.deleteMany({ where: { serviceRequestId: { in: requestIds } } });
  await tx.serviceRequestStatusHistory.deleteMany({ where: { serviceRequestId: { in: requestIds } } });
  await tx.attachment.deleteMany({ where: { serviceRequestId: { in: requestIds } } });
  await tx.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
}

async function detachAndDeleteAttachmentsByUploader(tx: Tx, uploadedById: string) {
  const attachments = await tx.attachment.findMany({ where: { uploadedById }, select: { id: true } });
  const attachmentIds = attachments.map((attachment) => attachment.id);
  if (attachmentIds.length === 0) return;

  await tx.quote.updateMany({ where: { attachmentId: { in: attachmentIds } }, data: { attachmentId: null } });
  await tx.quote.updateMany({ where: { pdfAttachmentId: { in: attachmentIds } }, data: { pdfAttachmentId: null } });
  await tx.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
}
