import { UserRole } from '@prisma/client';

const clientRoles: UserRole[] = [UserRole.CLIENTE_SOLICITANTE, UserRole.CLIENTE_GESTOR, UserRole.CLIENTE_FINANCEIRO];

export const isAdmin = (role: UserRole) => role === UserRole.ADMIN_MD;
export const isClient = (role: UserRole) => clientRoles.includes(role);
export const canManageMd = isAdmin;
export const canCreateRequest = isClient;
export const canApproveQuote = isClient;
export const canRequestInvoice = isClient;
export const clientRoleForPersistence = UserRole.CLIENTE_SOLICITANTE;
export const displayRole = (role: UserRole) => (isAdmin(role) ? 'Administrador MD' : 'Cliente');
export const clientRoleFilter = () => ({ in: clientRoles });
