'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { normalizeImei, isValidImei } from '@/lib/imei';
import { canManageMd } from '@/lib/rbac';
import type { ActionState } from '@/lib/actions';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function updateServiceRequestAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    const requestId = text(form, 'requestId');
    const companyId = text(form, 'companyId');
    const setor = text(form, 'setor');
    const responsavel = text(form, 'responsavel');
    const telefone = text(form, 'telefone');
    const tipoAparelho = text(form, 'tipoAparelho');
    const marca = text(form, 'marca');
    const modelo = text(form, 'modelo');
    const serial = normalizeImei(text(form, 'serial'));
    const problema = text(form, 'problema');
    const observacoes = text(form, 'observacoes') || null;

    if (!requestId || !companyId || !setor || !responsavel || !telefone || !tipoAparelho || !marca || !modelo || !serial || !problema) {
      return { status: 'error', message: 'Preencha os campos obrigatorios da solicitacao.' };
    }

    if (!isValidImei(serial)) return { status: 'error', message: 'O IMEI deve conter exatamente 15 algarismos numericos.' };

    const existing = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { status: 'error', message: 'Solicitacao nao encontrada.' };

    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { companyId, setor, responsavel, telefone, tipoAparelho, marca, modelo, serial, problema, observacoes }
    });

    await audit(user.id, 'SERVICE_REQUEST_UPDATED', 'ServiceRequest', requestId, { protocol: existing.protocol });
    revalidatePath('/dashboard');
    revalidatePath(`/requests/${requestId}`);
    return { status: 'success', message: 'Solicitacao atualizada com sucesso.' };
  } catch (error) {
    console.error('[service-request] Falha ao editar solicitacao', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return { status: 'error', message: 'Nao foi possivel editar a solicitacao.' };
  }
}

export async function deleteServiceRequestAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    const requestId = text(form, 'requestId');
    const existing = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { status: 'error', message: 'Solicitacao nao encontrada.' };

    await prisma.$transaction(async (tx) => {
      await tx.warranty.deleteMany({ where: { serviceRequestId: requestId } });
      const quotes = await tx.quote.findMany({ where: { serviceRequestId: requestId }, select: { id: true } });
      const quoteIds = quotes.map((quote) => quote.id);
      if (quoteIds.length > 0) {
        await tx.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
        await tx.quote.deleteMany({ where: { id: { in: quoteIds } } });
      }
      await tx.notificationLog.deleteMany({ where: { serviceRequestId: requestId } });
      await tx.serviceRequestStatusHistory.deleteMany({ where: { serviceRequestId: requestId } });
      await tx.attachment.deleteMany({ where: { serviceRequestId: requestId } });
      await tx.serviceRequest.delete({ where: { id: requestId } });
    });

    await audit(user.id, 'SERVICE_REQUEST_DELETED', 'ServiceRequest', requestId, { protocol: existing.protocol });
    revalidatePath('/dashboard');
    return { status: 'success', message: `Solicitacao ${existing.protocol} excluida com sucesso.` };
  } catch (error) {
    console.error('[service-request] Falha ao excluir solicitacao', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return { status: 'error', message: 'Nao foi possivel excluir a solicitacao.' };
  }
}
