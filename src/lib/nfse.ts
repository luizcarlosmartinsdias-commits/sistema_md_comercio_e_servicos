'use server';

import { revalidatePath } from 'next/cache';
import { QuoteStatus, ServiceRequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canManageMd } from '@/lib/rbac';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function prepareNfseEmissionAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');

  const requestId = text(form, 'requestId');
  const request = await prisma.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      company: true,
      quotes: {
        where: { status: QuoteStatus.APROVADO },
        include: { items: true },
        orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
        take: 1
      }
    }
  });

  const quote = request.quotes[0];
  if (!quote) throw new Error('A O.S. precisa ter orçamento aprovado para preparar a NFS-e.');

  const itemNames = quote.items.map((item) => item.description.split(':')[0].trim()).filter(Boolean);
  const serviceDescription = `Conserto de eletroeletrônico conforme O.S. ${request.protocol}. Serviços realizados: ${itemNames.join(', ') || 'assistência técnica'}.`;

  await audit(user.id, 'NFSE_PREPARED_FOR_DIRECT_EMISSION', 'ServiceRequest', requestId, {
    municipio: 'Araruama/RJ',
    codigoIbge: '3300209',
    inscricaoMunicipal: '8003346',
    codigoTributacaoNacional: '14.02.01',
    descricaoServico: serviceDescription,
    valorServico: quote.totalCents / 100,
    tomador: { nome: request.company.name, documento: request.company.document }
  });

  await prisma.serviceRequestStatusHistory.create({
    data: {
      serviceRequestId: requestId,
      fromStatus: request.currentStatus,
      toStatus: request.currentStatus,
      changedById: user.id,
      note: 'NFS-e preparada para emissão direta. Próxima etapa: integração com API Nacional usando e-CNPJ A1.'
    }
  });

  revalidatePath('/invoices');
  revalidatePath(`/requests/${requestId}`);
}

export async function markNfseIssuedAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');

  const requestId = text(form, 'requestId');
  const nfseNumber = text(form, 'nfseNumber');
  const accessKey = text(form, 'accessKey');
  const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      currentStatus: ServiceRequestStatus.NOTA_EMITIDA,
      statusHistory: {
        create: {
          fromStatus: request.currentStatus,
          toStatus: ServiceRequestStatus.NOTA_EMITIDA,
          changedById: user.id,
          note: ['NFS-e emitida.', nfseNumber ? `Número: ${nfseNumber}.` : '', accessKey ? `Chave: ${accessKey}.` : ''].filter(Boolean).join(' ')
        }
      }
    }
  });

  await audit(user.id, 'NFSE_MARKED_AS_ISSUED', 'ServiceRequest', requestId, { nfseNumber, accessKey });
  revalidatePath('/invoices');
  revalidatePath(`/requests/${requestId}`);
}
