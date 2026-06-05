import { UserRole } from '@prisma/client';

export const isAdmin = (role: UserRole) => role === UserRole.ADMIN_MD;
export const canManageMd = isAdmin;
export const canCreateRequest = (role: UserRole) => role === UserRole.CLIENTE_SOLICITANTE || role === UserRole.CLIENTE_GESTOR || role === UserRole.ADMIN_MD;
export const canApproveQuote = (role: UserRole) => role === UserRole.CLIENTE_GESTOR;
export const canRequestInvoice = (role: UserRole) => role === UserRole.CLIENTE_GESTOR || role === UserRole.CLIENTE_FINANCEIRO;
