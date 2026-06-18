'use server';

import { redirect } from 'next/navigation';
import { ServiceRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canCreateRequest } from '@/lib/rbac';
import { nextProtocol } from '@/lib/protocol';
import { requireValidImei } from '@/lib/imei';
import { NotificationService } from '@/lib/services/notification';

const notifications = new NotificationService(prisma);
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function createNormalizedServiceRequestAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canCreateRequest(user.role) || !user.companyId) throw new Error('Usuario cliente sem empresa vinculada');

  const serial = requireValidImei(text(form, 'serial'));

  const request = await prisma.serviceRequest.create({
    data: {
      protocol: await nextProtocol(),
      companyId: user.companyId,
      requesterId: user.id,
      setor: text(form, 'setor'),
      responsavel: text(form, 'responsavel'),
      telefone: text(form, 'telefone'),
      tipoAparelho: text(form, 'tipoAparelho'),
      marca: text(form, 'marca'),
      modelo: text(form, 'modelo'),
      serial,
      problema: text(form, 'problema'),
      observacoes: text(form, 'observacoes') || null,
      statusHistory: {
        create: {
          toStatus: ServiceRequestStatus.AGUARDANDO_RECOLHIMENTO,
          changedById: user.id,
          note: 'Solicitação aberta'
        }
      }
    }
  });

  try {
    await notifications.notifyMd('Nova solicitação de recolhimento', `${request.protocol} foi aberta.`, request.id);
  } catch (error) {
    console.error('[notification] Falha ao notificar MD', { serviceRequestId: request.id, subject: 'Nova solicitação de recolhimento', error: error instanceof Error ? error.message : 'Erro desconhecido' });
  }

  await audit(user.id, 'SERVICE_REQUEST_CREATED', 'ServiceRequest', request.id);
  redirect(`/requests/${request.id}`);
}
