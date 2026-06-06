import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { DashboardInviteForm } from '@/components/dashboard-invite-form';
import { CopyInviteLinkButton } from '@/components/copy-invite-link-button';
import { ClientManagementForms } from '@/components/client-management-forms';
import { requireSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createCompanyAction, createServiceRequestAction } from '@/lib/actions';
import { canCreateRequest, clientRoleFilter, displayRole, isAdmin } from '@/lib/rbac';

const roleOptions = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: UserRole.ADMIN_MD, label: 'Administrador MD' }
];

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const admin = isAdmin(user.role);
  let dataWarning: string | null = null;
  const now = new Date();

  const captureDataError = (section: string) => (error: unknown) => {
    console.error('[dashboard] Falha ao carregar secao', { section, error: error instanceof Error ? error.message : 'Erro desconhecido' });
    dataWarning = 'Alguns dados nao puderam ser carregados agora. Tente atualizar a pagina.';
    return [];
  };

  const companies = admin ? await prisma.company.findMany({ orderBy: { createdAt: 'desc' } }).catch(captureDataError('empresas')) : [];
  const clients = admin ? await prisma.user.findMany({ where: { role: clientRoleFilter() }, include: { company: true }, orderBy: { createdAt: 'desc' } }).catch(captureDataError('clientes')) : [];
  const invitations = admin ? await prisma.invitationToken.findMany({ include: { company: true }, orderBy: { createdAt: 'desc' } }).catch(captureDataError('convites')) : [];
  const requests = await prisma.serviceRequest.findMany({
    where: admin ? {} : { companyId: user.companyId ?? '__sem_empresa__' },
    include: { company: true, requester: true, quotes: true },
    orderBy: { createdAt: 'desc' }
  }).catch(captureDataError('solicitacoes'));

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div><h1 className="text-2xl font-bold">Painel {admin ? 'administrativo MD' : 'do cliente'}</h1><p className="text-sm text-slate-600">{admin ? 'Visao completa de empresas, clientes, convites e solicitacoes.' : `Empresa vinculada: ${user.company?.name ?? 'nao informada'}`}</p></div>
    {dataWarning ? <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{dataWarning}</p> : null}

    {admin ? <section className="grid gap-4 lg:grid-cols-2"><div className="card"><h2 className="font-semibold">Cadastrar empresa</h2><form action={createCompanyAction} className="mt-4 grid gap-3"><input name="name" placeholder="Nome da empresa" required /><input name="document" placeholder="CNPJ ou documento" /><input name="email" type="email" placeholder="E-mail" /><input name="phone" placeholder="Telefone" /><button className="btn">Salvar empresa</button></form></div><div className="card"><h2 className="font-semibold">Convidar usuario</h2><DashboardInviteForm companies={companies.map((company) => ({ id: company.id, name: company.name }))} roles={roleOptions} /></div></section> : null}

    {admin ? <section className="card"><h2 className="font-semibold">Empresas cadastradas</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-b last:border-0"><td className="py-3 font-medium">{company.name}</td><td>{company.document ?? '-'}</td><td>{company.email ?? '-'}</td><td>{company.phone ?? '-'}</td></tr>)}</tbody></table>{companies.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma empresa cadastrada.</p> : null}</div></section> : null}

    {admin ? <section className="card"><h2 className="font-semibold">Clientes cadastrados</h2><div className="mt-4 space-y-4">{clients.map((client) => <div key={client.id} className="rounded-md border border-slate-200 p-3"><div className="grid gap-2 text-sm md:grid-cols-5"><div><span className="font-semibold">Nome</span><br />{client.name}</div><div><span className="font-semibold">E-mail</span><br />{client.email}</div><div><span className="font-semibold">Empresa</span><br />{client.company?.name ?? '-'}</div><div><span className="font-semibold">Status</span><br />{client.active ? 'ativo' : 'inativo'}</div><div><span className="font-semibold">Cadastro</span><br />{client.createdAt.toLocaleString('pt-BR')}<br /><span className="text-xs text-slate-500">Ultimo acesso: nao registrado</span></div></div><div className="mt-3"><ClientManagementForms client={{ id: client.id, name: client.name, email: client.email, companyId: client.companyId, active: client.active }} companies={companies.map((company) => ({ id: company.id, name: company.name }))} /></div></div>)}{clients.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhum cliente cadastrado.</p> : null}</div></section> : null}

    {admin ? <section className="card"><h2 className="font-semibold">Convites pendentes</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>E-mail</th><th>Perfil</th><th>Empresa</th><th>Expira em</th><th>Status</th><th></th></tr></thead><tbody>{invitations.map((invitation) => {
      const status = invitation.acceptedAt ? 'aceito' : invitation.expiresAt < now ? 'expirado' : 'pendente';
      const inviteLink = status === 'pendente' && invitation.plainToken ? `${appUrl()}/invite/${invitation.plainToken}` : null;
      return <tr key={invitation.id} className="border-b last:border-0"><td className="py-3 font-medium">{invitation.name}</td><td>{invitation.email}</td><td>{displayRole(invitation.role)}</td><td>{invitation.company?.name ?? '-'}</td><td>{invitation.expiresAt.toLocaleString('pt-BR')}</td><td><span className="badge">{status}</span></td><td>{inviteLink ? <CopyInviteLinkButton link={inviteLink} /> : status === 'pendente' ? <span className="text-xs text-slate-500">Link indisponivel</span> : null}</td></tr>;
    })}</tbody></table>{invitations.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhum convite cadastrado.</p> : null}</div></section> : null}

    {canCreateRequest(user.role) ? <section className="card"><h2 className="font-semibold">Nova solicitacao de recolhimento</h2><form action={createServiceRequestAction} className="mt-4 grid gap-3 md:grid-cols-2"><input name="setor" placeholder="Setor" required /><input name="responsavel" placeholder="Responsavel" required /><input name="telefone" placeholder="Telefone" required /><input name="tipoAparelho" placeholder="Tipo de aparelho" required /><input name="marca" placeholder="Marca" required /><input name="modelo" placeholder="Modelo" required /><input name="serial" placeholder="IMEI ou numero de serie" required /><textarea name="problema" placeholder="Problema informado" required className="md:col-span-2" /><textarea name="observacoes" placeholder="Observacoes" className="md:col-span-2" /><button className="btn md:col-span-2">Abrir solicitacao</button></form></section> : null}

    <section className="card"><h2 className="font-semibold">Solicitacoes / acompanhamento</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Protocolo</th><th>Empresa</th><th>Status</th><th>Solicitante</th><th></th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-b last:border-0"><td className="py-3 font-medium">{request.protocol}</td><td>{request.company.name}</td><td><span className="badge">{request.currentStatus}</span></td><td>{request.requester.name}</td><td><Link className="text-mdblue font-semibold" href={`/requests/${request.id}`}>Abrir</Link></td></tr>)}</tbody></table>{requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitação cadastrada.</p> : null}</div></section>
  </main>;
}

function appUrl() {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
