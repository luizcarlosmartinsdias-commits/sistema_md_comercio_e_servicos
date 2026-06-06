'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AttachmentType, QuoteStatus, ServiceRequestStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSessionUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { canApproveQuote, canCreateRequest, canManageMd, canRequestInvoice, clientRoleFilter, clientRoleForPersistence, displayRole, isClient } from '@/lib/rbac';
import { addHours, createPlainToken, hashToken } from '@/lib/tokens';
import { hashPassword } from '@/lib/password';
import { nextProtocol } from '@/lib/protocol';
import { NotificationService } from '@/lib/services/notification';
import { StorageService } from '@/lib/services/storage';

export type ActionStatus = 'idle' | 'success' | 'warning' | 'error';
export type ActionState = { status: ActionStatus; message: string };

const notifications = new NotificationService(prisma);
const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function signOutAction() { redirect('/api/auth/signout?callbackUrl=/login'); }

export async function createCompanyAction(form: FormData) {
  const user = await requireSessionUser();
  if (!canManageMd(user.role)) throw new Error('Acesso negado');
  const company = await prisma.company.create({ data: { name: text(form, 'name'), document: text(form, 'document') || null, email: text(form, 'email') || null, phone: text(form, 'phone') || null } });
  await audit(user.id, 'COMPANY_CREATED', 'Company', company.id);
  revalidatePath('/dashboard');
}

export async function inviteUserAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };

    const name = text(form, 'name');
    const email = text(form, 'email').toLowerCase();
    const requestedRole = text(form, 'role');
    const role = requestedRole === 'ADMIN_MD' ? UserRole.ADMIN_MD : clientRoleForPersistence;
    const companyId = role === UserRole.ADMIN_MD ? null : text(form, 'companyId') || null;

    if (!name) return { status: 'error', message: 'Informe o nome do usuario.' };
    if (!email || !email.includes('@')) return { status: 'error', message: 'Informe um e-mail valido.' };
    if (requestedRole !== 'CLIENTE' && requestedRole !== 'ADMIN_MD') return { status: 'error', message: 'Perfil de usuario invalido.' };
    if (role !== UserRole.ADMIN_MD && !companyId) return { status: 'error', message: 'Cliente precisa estar vinculado a uma empresa.' };

    const existingActiveUser = await prisma.user.findUnique({ where: { email } });
    if (existingActiveUser?.active) return { status: 'error', message: 'Este usuario ja existe e esta ativo.' };

    const plainToken = createPlainToken();
    const invitation = await prisma.invitationToken.create({
      data: { email, name, role, companyId, plainToken, tokenHash: hashToken(plainToken), expiresAt: addHours(72), createdById: user.id }
    });
    const link = `${appUrl()}/invite/${plainToken}`;

    let emailSent = true;
    try {
      await notifications.email({ recipient: invitation.email, subject: 'Convite para o Portal MD', body: `Acesse ${link} para criar sua senha.` });
    } catch (error) {
      emailSent = false;
      console.error('[invite] Convite criado, mas envio de e-mail falhou', { invitationId: invitation.id, email: invitation.email, error: errorMessage(error) });
    }

    await audit(user.id, 'USER_INVITED', 'InvitationToken', invitation.id, { email: invitation.email, role: displayRole(role), emailSent });
    revalidatePath('/dashboard');

    if (!emailSent) return { status: 'warning', message: 'Convite criado, mas houve falha no envio do e-mail.' };
    return { status: 'success', message: `Convite enviado com sucesso para ${invitation.email}.` };
  } catch (error) {
    console.error('[invite] Falha ao criar convite', { error: errorMessage(error) });
    return { status: 'error', message: 'Nao foi possivel enviar o convite.' };
  }
}

export async function acceptInvitationAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  const token = text(form, 'token');
  const password = text(form, 'password');
  const confirmPassword = text(form, 'confirmPassword');

  if (!token) return { status: 'error', message: 'Convite invalido.' };
  if (password.length < 8) return { status: 'error', message: 'A senha deve ter pelo menos 8 caracteres.' };
  if (password !== confirmPassword) return { status: 'error', message: 'As senhas informadas nao conferem.' };

  try {
    const tokenHash = hashToken(token);
    const invitation = await prisma.invitationToken.findUnique({ where: { tokenHash } });

    if (!invitation) return { status: 'error', message: 'Convite invalido. Solicite um novo convite ao administrador.' };
    if (invitation.acceptedAt) return { status: 'error', message: 'Este convite ja foi aceito. Acesse a tela de login.' };
    if (invitation.expiresAt < new Date()) return { status: 'error', message: 'Este convite expirou. Solicite um novo convite ao administrador.' };
    if (isClient(invitation.role) && !invitation.companyId) return { status: 'error', message: 'Convite sem empresa vinculada. Solicite um novo convite ao administrador.' };

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email: invitation.email },
      update: { name: invitation.name, role: invitation.role, companyId: invitation.companyId, passwordHash, active: true },
      create: { name: invitation.name, email: invitation.email, role: invitation.role, companyId: invitation.companyId, passwordHash }
    });
    await prisma.invitationToken.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await audit(user.id, 'INVITATION_ACCEPTED', 'User', user.id, { invitationId: invitation.id });
  } catch (error) {
    console.error('[invite] Falha ao aceitar convite', { tokenFingerprint: tokenFingerprint(token), error: errorMessage(error) });
    return { status: 'error', message: 'Nao foi possivel criar seu acesso agora. Tente novamente ou solicite um novo convite.' };
  }

  redirect('/login?message=cadastro-criado');
}

export async function updateClientAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireSessionUser();
    if (!canManageMd(user.role)) return { status: 'error', message: 'Acesso negado.' };
    const clientId = text(form, 'clientId');
    const name = text(form, 'name');
    const email = text(form, 'email').toLowerCase();
    const companyId = text(form, 'companyId');
    if (!name || !email || !companyId) return { status: 'error', message: 'Informe nome, e-mail e empresa.' };
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client || !isClient(client.role)) return { status: 'error', message: 'Cliente nao encontrado.' };
    await prisma.user.update({ where: { id: clientId }, data: { name, email, companyId } });
    await audit(user.id, 'CLIENT_UPDATED', 'User', clientId, { email });
    revalidatePath('/dashboard');
    return { status: 'success', message: 'Cliente atualizado com sucesso.' };
  } catch (error) {
    console.error('[client] Falha ao editar cliente', { error: errorMessage(error) });
    return { status: 'error', message: 'Nao foi possivel editar o cliente.' };
  }
}

export async function deactivateClientAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  return setClientActive(form, false, 'Cliente inativado com sucesso.', 'CLIENT_DEACTIVATED');
}

export async function reactivateClientAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  return setClientActive(form, true, 'Cliente reativado com sucesso.', 'CLIENT_REACTIVATED');
}

export async function deleteClientAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const admin = await requireSessionUser();
    if (!canManageMd(admin.role)) return { status: 'error', message: 'Acesso negado.' };
    const clientId = text(form, 'clientId');
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client || !isClient(client.role)) return { status: 'error', message: 'Cliente nao encontrado.' };

    const hasHistory = await clientHasHistory(clientId);
    if (hasHistory) {
      await prisma.user.update({ where: { id: clientId }, data: { active: false } });
      await audit(admin.id, 'CLIENT_DEACTIVATED_PRESERVE_HISTORY', 'User', clientId);
      revalidatePath('/dashboard');
      return { status: 'warning', message: 'Este cliente possui historico e foi inativado para preservar os registros.' };
    }

    await prisma.user.delete({ where: { id: clientId } });
    await audit(admin.id, 'CLIENT_DELETED', 'User', clientId);
    revalidatePath('/dashboard');
    return { status: 'success', message: 'Cliente excluido com sucesso.' };
  } catch (error) {
    console.error('[client] Falha ao excluir cliente', { error: errorMessage(error) });
    return { status: 'error', message: 'Nao foi possivel excluir o cliente.' };
  }
}

async function setClientActive(form: FormData, active: boolean, message: string, auditAction: string): Promise<ActionState> {
  try {
    const admin = await requireSessionUser();
    if (!canManageMd(admin.role)) return { status: 'error', message: 'Acesso negado.' };
    const clientId = text(form, 'clientId');
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client || !isClient(client.role)) return { status: 'error', message: 'Cliente nao encontrado.' };
    await prisma.user.update({ where: { id: clientId }, data: { active } });
    await audit(admin.id, auditAction, 'User', clientId);
    revalidatePath('/dashboard');
    return { status: 'success', message };
  } catch (error) {
    console.error('[client] Falha ao alterar status do cliente', { error: errorMessage(error), active });
    return { status: 'error', message: active ? 'Nao foi possivel reativar o cliente.' : 'Nao foi possivel inativar o cliente.' };
  }
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
  await notifyCompanyClients(requestId, 'Status da solicitacao atualizado', `${current.protocol} agora esta com status ${status}.`);
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
  await notifyCompanyClients(requestId, 'Orcamento aguardando aprovacao', `O orcamento ${quote.title} esta disponivel para aprovacao.`);
  await audit(user.id, 'QUOTE_CREATED', 'Quote', quote.id);
  revalidatePath(`/requests/${requestId}`);
}

export async function approveQuoteAction(form: FormData) { await decideQuote(form, true); }
export async function rejectQuoteAction(form: FormData) { await decideQuote(form, false); }

async function decideQuote(form: FormData, approved: boolean) {
  const user = await requireSessionUser();
  if (!canApproveQuote(user.role)) throw new Error('Acesso negado');
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: text(form, 'quoteId') }, include: { serviceRequest: true } });
  if (quote.serviceRequest.companyId !== user.companyId) throw new Error('Acesso negado');
  const status = approved ? ServiceRequestStatus.ORCAMENTO_APROVADO : ServiceRequestStatus.ORCAMENTO_RECUSADO;
  const note = text(form, 'note') || null;
  await prisma.quote.update({ where: { id: quote.id }, data: { status: approved ? QuoteStatus.APROVADO : QuoteStatus.RECUSADO, decidedAt: new Date(), decisionNote: note } });
  await prisma.serviceRequest.update({ where: { id: quote.serviceRequestId }, data: { currentStatus: status, statusHistory: { create: { fromStatus: quote.serviceRequest.currentStatus, toStatus: status, changedById: user.id, note: approved ? 'Orcamento aprovado' : note || 'Orcamento recusado' } } } });
  await notifications.notifyMd(approved ? 'Orcamento aprovado' : 'Orcamento recusado', `${quote.serviceRequest.protocol} teve decisao do cliente.`, quote.serviceRequestId);
  await notifyCompanyClients(quote.serviceRequestId, approved ? 'Orcamento aprovado' : 'Orcamento recusado', `${quote.serviceRequest.protocol} teve decisao de orcamento registrada.`);
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
  const allowedClientTypes: AttachmentType[] = [AttachmentType.FOTO_PROBLEMA, AttachmentType.OS_CLIENTE, AttachmentType.OUTRO];
  if (!allowedClientTypes.includes(type)) throw new Error('Tipo de anexo restrito a MD');
}

async function notifyCompanyClients(requestId: string, subject: string, body: string) {
  const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
  const clients = await prisma.user.findMany({ where: { companyId: request.companyId, role: clientRoleFilter(), active: true } });
  await Promise.all(clients.map((client) => notifications.email({ serviceRequestId: requestId, recipient: client.email, subject, body })));
}

async function clientHasHistory(clientId: string) {
  const [requests, statusChanges, attachments, auditLogs] = await Promise.all([
    prisma.serviceRequest.count({ where: { requesterId: clientId } }),
    prisma.serviceRequestStatusHistory.count({ where: { changedById: clientId } }),
    prisma.attachment.count({ where: { uploadedById: clientId } }),
    prisma.auditLog.count({ where: { userId: clientId } })
  ]);
  return requests + statusChanges + attachments + auditLogs > 0;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

function tokenFingerprint(token: string) {
  return hashToken(token).slice(0, 12);
}
