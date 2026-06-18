import { AttachmentType, NotificationChannel, QuoteStatus, ServiceRequestStatus, WarrantyStatus } from '@prisma/client';

export const serviceRequestStatusLabels: Record<ServiceRequestStatus, string> = {
  [ServiceRequestStatus.AGUARDANDO_RECOLHIMENTO]: 'Aguardando recolhimento',
  [ServiceRequestStatus.APARELHO_RECOLHIDO]: 'Aparelho recolhido',
  [ServiceRequestStatus.ORCAMENTO_EM_PRODUCAO]: 'Orçamento em produção',
  [ServiceRequestStatus.AGUARDANDO_APROVACAO]: 'Aguardando aprovação',
  [ServiceRequestStatus.ORCAMENTO_APROVADO]: 'Orçamento aprovado',
  [ServiceRequestStatus.ORCAMENTO_RECUSADO]: 'Orçamento recusado',
  [ServiceRequestStatus.SERVICO_EM_EXECUCAO]: 'Serviço em execução',
  [ServiceRequestStatus.SERVICO_CONCLUIDO]: 'Serviço concluído',
  [ServiceRequestStatus.AGUARDANDO_OS_CLIENTE]: 'Aguardando O.S. do cliente',
  [ServiceRequestStatus.OS_RECEBIDA_PARA_ASSINATURA]: 'O.S. recebida para assinatura',
  [ServiceRequestStatus.OS_ASSINADA_ENVIADA]: 'O.S. assinada enviada',
  [ServiceRequestStatus.AGUARDANDO_SOLICITACAO_NOTA]: 'Aguardando solicitação de nota',
  [ServiceRequestStatus.NOTA_SOLICITADA]: 'Nota solicitada',
  [ServiceRequestStatus.NOTA_EMITIDA]: 'Nota emitida',
  [ServiceRequestStatus.FINALIZADO]: 'Finalizado'
};

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  [QuoteStatus.RASCUNHO]: 'Rascunho',
  [QuoteStatus.ENVIADO]: 'Enviado',
  [QuoteStatus.APROVADO]: 'Aprovado',
  [QuoteStatus.RECUSADO]: 'Recusado'
};

export const warrantyStatusLabels: Record<WarrantyStatus, string> = {
  [WarrantyStatus.ATIVA]: 'Ativa',
  [WarrantyStatus.VENCIDA]: 'Vencida',
  [WarrantyStatus.SOLICITACAO_ABERTA]: 'Solicitação aberta',
  [WarrantyStatus.EM_ANALISE]: 'Em análise',
  [WarrantyStatus.APROVADA]: 'Aprovada',
  [WarrantyStatus.RECUSADA]: 'Recusada',
  [WarrantyStatus.FINALIZADA]: 'Finalizada'
};

export const attachmentTypeLabels: Record<AttachmentType, string> = {
  [AttachmentType.FOTO_PROBLEMA]: 'Foto do problema',
  [AttachmentType.ORCAMENTO]: 'Orçamento',
  [AttachmentType.OS_CLIENTE]: 'O.S. do cliente',
  [AttachmentType.OS_ASSINADA_MD]: 'O.S. assinada pela MD',
  [AttachmentType.NOTA_FISCAL]: 'Nota fiscal',
  [AttachmentType.OUTRO]: 'Outro'
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  [NotificationChannel.EMAIL]: 'E-mail',
  [NotificationChannel.WHATSAPP]: 'WhatsApp',
  [NotificationChannel.INTERNAL]: 'Interna'
};

export function serviceRequestStatusLabel(status: ServiceRequestStatus | string) {
  return serviceRequestStatusLabels[status as ServiceRequestStatus] ?? fallbackLabel(status);
}

export function quoteStatusLabel(status: QuoteStatus | string) {
  return quoteStatusLabels[status as QuoteStatus] ?? fallbackLabel(status);
}

export function warrantyStatusLabel(status: WarrantyStatus | string | null) {
  if (!status) return '-';
  return warrantyStatusLabels[status as WarrantyStatus] ?? fallbackLabel(status);
}

export function attachmentTypeLabel(type: AttachmentType | string) {
  return attachmentTypeLabels[type as AttachmentType] ?? fallbackLabel(type);
}

export function notificationChannelLabel(channel: NotificationChannel | string) {
  return notificationChannelLabels[channel as NotificationChannel] ?? fallbackLabel(channel);
}

export function notificationStatusLabel(status: string) {
  if (status === 'SENT') return 'Enviado';
  if (status === 'FAILED') return 'Falhou';
  if (status === 'PENDING') return 'Pendente';
  return fallbackLabel(status);
}

function fallbackLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part, index) => index === 0 ? capitalize(part) : part)
    .join(' ');
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
