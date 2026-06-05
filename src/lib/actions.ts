'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AttachmentType, QuoteStatus, ServiceRequestStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canApproveQuote, canCreateRequest, canManageMd, canRequestInvoice } from '@/lib/rbac';
import { addHours, createPlainToken, hashToken } from '@/lib/tokens';
import { hashPassword } from '@/lib/password';
import { nextProtocol } from '@/lib/protocol';
import { NotificationService } from '@/lib/services/notification';
import { StorageService } from '@/lib/services/storage';

const notifications = new NotificationService(prisma);
const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000';
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function signOutAction() { redirect('/api/auth/signout?callbackUrl=/login'); }

export async function createCompanyAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');
  const company = await prisma.company.create({ data: { name: text(form, 'name'), document: text(form, 'document') || null, email: text(form, 'email') || null, phone: text(form, 'phone') || null } });
  await audit(user.id, 'COMPANY_CREATED', 'Company', company.id);
  revalidatePath('/dashboard');
}

export async function inviteUserAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');
  const role = text(form, 'role') as UserRole;
  const companyId = role === UserRole.ADMIN_MD ? null : text(form, 'companyId') || null;
  if (role !== UserRole.ADMIN_MD && !companyId) throw new Error('Usuarios clientes precisam de empresa vinculada');
  const plainToken = createPlainToken();
  const invitation = await prisma.invitationToken.create({ data: { email: text(form, 'email').toLowerCase(), name: text(form, 'name'), role, companyId, tokenHash: hashToken(plainToken), expiresAt: addHours(72), createdById: user.id } });
  const link = `${appUrl()}/invite/${plainToken}`;
  await notifications.email({ recipient: invitation.email, subject: 'Convite para o Portal MD', body: `Acesse ${link} para criar sua senha.` });
  await audit(user.id, 'USER_INVITED', 'InvitationToken', invitation.id, { email: invitation.email, role });
  revalidatePath('/dashboard');
}

export async function acceptInvitationAction(form: FormData) {
  const tokenHash = hashToken(text(form, 'token'));
  const invitation = await prisma.invitationToken.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new Error('Convite invalido ou expirado');
  const passwordHash = await hashPassword(text(form, 'password'));
  const user = await prisma.user.upsert({ where: { email: invitation.email }, update: { name: invitation.name, role: invitation.role, companyId: invitation.companyId, passwordHash, active: true }, create: { name: invitation.name, email: invitation.email, role: invitation.role, companyId: invitation.companyId, passwordHash } });
  await prisma.invitationToken.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  await audit(user.id, 'INVITATION_ACCEPTED', 'User', user.id);
  redirect('/login');
}

export async function requestPasswordResetAction(form: FormData) {
  const user = await prisma.user.findUnique({ where: { email: text(form, 'email').toLowerCase() } });
  if (user) {
    const token = createPlainToken();
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: addHours(2) } });
    await notifications.email({ recipient: user.email, subject: 'Redefinicao de senha do Portal MD', body: `Redefina sua senha em ${appUrl()}/reset-password/${token}` });
    await audit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);
  }
  redirect('/login');
}

export async function resetPasswordAction(form: FormData) {
  const tokenHash = hashToken(text(form, 'token'));
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new Error('Token invalido ou expirado');
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(text(form, 'password')) } });
  await prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  await audit(reset.userId, 'PASSWORD_RESET_COMPLETED', 'User', reset.userId);
  redirect('/login');
}

export async function createServiceRequestAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canCreateRequest(user.role) || !user.companyId) throw new Error('Usuario cliente sem empresa vinculada');
  const request = await prisma.serviceRequest.create({ data: { protocol: await nextProtocol(), companyId: user.companyId, requesterId: user.id, setor: text(form, 'setor'), responsavel: text(form, 'responsavel'), telefone: text(form, 'telefone'), tipoAparelho: text(form, 'tipoAparelho'), marca: text(form, 'marca'), modelo: text(form, 'modelo'), serial: text(form, 'serial'), problema: text(form, 'problema'), observacoes: text(form, 'observacoes') || null, statusHistory: { create: { toStatus: ServiceRequestStatus.AGUARDANDO_RECOLHIMENTO, changedById: user.id, note: 'Solicitacao aberta' } } } });
  await notifications.notifyMd('Nova solicitacao de recolhimento', `${request.protocol} foi aberta.`, request.id);
  await audit(user.id, 'SERVICE_REQUEST_CREATED', 'ServiceRequest', request.id);
  redirect(`/requests/${request.id}`);
}

export async function updateStatusAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');
  const requestId = text(form, 'requestId');
  const status = text(form, 'status') as ServiceRequestStatus;
  const current = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { currentStatus: status, statusHistory: { create: { fromStatus: current.currentStatus, toStatus: status, changedById: user.id, note: text(form, 'note') || null } } } });
  await audit(user.id, 'STATUS_CHANGED', 'ServiceRequest', requestId, { from: current.currentStatus, to: status });
  revalidatePath(`/requests/${requestId}`);
}

export async function createQuoteAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');
  const requestId = text(form, 'requestId');
  const current = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  const quantity = Number(text(form, 'quantity') || '1');
  const unitCents = Number(text(form, 'unitCents') || '0');
  let attachmentId: string | undefined;
  const file = form.get('file');
  if (file instanceof File && file.size > 0) attachmentId = (await saveAttachment(requestId, user.id, file, AttachmentType.ORCAMENTO)).id;
  const quote = await prisma.quote.create({ data: { serviceRequestId: requestId, title: text(form, 'title'), description: text(form, 'description') || null, status: QuoteStatus.ENVIADO, totalCents: quantity * unitCents, attachmentId, items: { create: { description: text(form, 'itemDescription'), quantity, unitCents } } } });
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { currentStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, statusHistory: { create: { fromStatus: current.currentStatus, toStatus: ServiceRequestStatus.AGUARDANDO_APROVACAO, changedById: user.id, note: 'Orcamento enviado ao cliente' } } } });
  await notifyCompanyManagers(requestId, 'Orcamento aguardando aprovacao', `O orcamento ${quote.title} esta disponivel para aprovacao.`);
  await audit(user.id, 'QUOTE_CREATED', 'Quote', quote.id);
  revalidatePath(`/requests/${requestId}`);
}

export async function approveQuoteAction(form: FormData) { await decideQuote(form, true); }
export async function rejectQuoteAction(form: FormData) { await decideQuote(form, false); }

async function decideQuote(form: FormData, approved: boolean) {
  const user = await requireSessionUser();
  if (!canApproveQuote(user.role)) throw new Error('Apenas CLIENTE_GESTOR aprova orcamentos');
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: text(form, 'quoteId') }, include: { serviceRequest: true } });
  if (quote.serviceRequest.companyId !== user.companyId) throw new Error('Acesso negado');
  const status = approved ? ServiceRequestStatus.ORCAMENTO_APROVADO : ServiceRequestStatus.ORCAMENTO_RECUSADO;
  await prisma.quote.update({ where: { id: quote.id }, data: { status: approved ? QuoteStatus.APROVADO : QuoteStatus.RECUSADO, decidedAt: new Date(), decisionNote: text(form, 'note') || null } });
  await prisma.serviceRequest.update({ where: { id: quote.serviceRequestId }, data: { currentStatus: status, statusHistory: { create: { fromStatus: quote.serviceRequest.currentStatus, toStatus: status, changedById: user.id, note: approved ? 'Orcamento aprovado' : 'Orcamento recusado' } } } });
  await notifications.notifyMd(approved ? 'Orcamento aprovado' : 'Orcamento recusado', `${quote.serviceRequest.protocol} teve decisao do cliente.`, quote.serviceRequestId);
  await audit(user.id, approved ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED', 'Quote', quote.id);
  revalidatePath(`/requests/${quote.serviceRequestId}`);
}

export async function uploadAttachmentAction(form: FormData) {
  const user = await requireSessionUser();
  const requestId = text(form, 'requestId');
  const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (!canManageMd(user.role) && request.companyId !== user.companyId) throw new Error('Acesso negado');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Arquivo obrigatorio');
  const type = text(form, 'type') as AttachmentType;
  assertCanUploadAttachment(user.role, type);
  const attachment = await saveAttachment(requestId, user.id, file, type);
  const nextStatus = type === AttachmentType.OS_CLIENTE ? ServiceRequestStatus.OS_RECEBIDA_PARA_ASSINATURA : type === AttachmentType.OS_ASSINADA_MD ? ServiceRequestStatus.OS_ASSINADA_ENVIADA : type === AttachmentType.NOTA_FISCAL ? ServiceRequestStatus.NOTA_EMITIDA : null;
  if (nextStatus) await prisma.serviceRequest.update({ where: { id: requestId }, data: { currentStatus: nextStatus, statusHistory: { create: { fromStatus: request.currentStatus, toStatus: nextStatus, changedById: user.id, note: `Anexo enviado: ${attachment.fileName}` } } } });
  if (!canManageMd(user.role) && type === AttachmentType.OS_CLIENTE) await notifications.notifyMd('O.S. enviada para assinatura', `${request.protocol} recebeu O.S. do cliente.`, requestId);
  await audit(user.id, 'ATTACHMENT_UPLOADED', 'Attachment', attachment.id, { type });
  revalidatePath(`/requests/${requestId}`);
}

export async function requestInvoiceAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canRequestInvoice(user.role)) throw new Error('Perfil sem permissao para solicitar nota');
  const requestId = text(form, 'requestId');
  const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.companyId !== user.companyId) throw new Error('Acesso negado');
  await prisma.serviceRequest.update({ where: { id: requestId }, data: { currentStatus: ServiceRequestStatus.NOTA_SOLICITADA, statusHistory: { create: { fromStatus: request.currentStatus, toStatus: ServiceRequestStatus.NOTA_SOLICITADA, changedById: user.id, note: 'Cliente solicitou nota fiscal' } } } });
  await notifications.notifyMd('Nota fiscal solicitada', `${request.protocol} solicitou emissao de nota fiscal.`, requestId);
  await audit(user.id, 'INVOICE_REQUESTED', 'ServiceRequest', requestId);
  revalidatePath(`/requests/${requestId}`);
}

async function saveAttachment(requestId: string, userId: string, file: File, type: AttachmentType) {
  const stored = await StorageService.save(file, requestId);
  return prisma.attachment.create({ data: { serviceRequestId: requestId, uploadedById: userId, type, ...stored } });
}

function assertCanUploadAttachment(role: UserRole, type: AttachmentType) {
  if (canManageMd(role)) return;
  const allowedClientTypes = [AttachmentType.FOTO_PROBLEMA, AttachmentType.OS_CLIENTE, AttachmentType.OUTRO];
  if (!allowedClientTypes.includes(type)) throw new Error('Tipo de anexo restrito a MD');
}

async function notifyCompanyManagers(requestId: string, subject: string, body: string) {
  const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  const managers = await prisma.user.findMany({ where: { companyId: request.companyId, role: UserRole.CLIENTE_GESTOR, active: true } });
  await Promise.all(managers.map((manager) => notifications.email({ serviceRequestId: requestId, recipient: manager.email, subject, body })));
}
