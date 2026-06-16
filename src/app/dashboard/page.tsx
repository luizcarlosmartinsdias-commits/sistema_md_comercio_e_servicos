import { Fragment } from 'react';
import Link from 'next/link';
import { UserRole, WarrantyStatus } from '@prisma/client';
import { DashboardInviteForm } from '@/components/dashboard-invite-form';
import { CopyInviteLinkButton } from '@/components/copy-invite-link-button';
import { ClientManagementForms } from '@/components/client-management-forms';
import { CompanyManagementForms } from '@/components/company-management-forms';
import { ServiceCatalogForms } from '@/components/service-catalog-forms';
import { RequestManagementForms } from '@/components/request-management-forms';
import { requireSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createCompanyAction, createServiceRequestAction } from '@/lib/actions';
import { openWarrantyClaimAction, updateWarrantyStatusAction } from '@/lib/warranty';
import { canCreateRequest, clientRoleFilter, displayRole, isAdmin } from '@/lib/rbac';

const roleOptions = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: UserRole.ADMIN_MD, label: 'Administrador MD' }
];

const views = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'solicitacoes', label: 'Solicitações' },
  { key: 'garantias', label: 'Garantias' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'convites', label: 'Convites' },
  { key: 'servicos', label: 'Serviços' }
];

export default async function DashboardPage({ searchParams }: { searchParams?: { view?: string } }) {
  const user = await requireSessionUser();
  const admin = isAdmin(user.role);
  const view = views.some((item) => item.key === searchParams?.view) ? String(searchParams?.view) : 'resumo';
  let dataWarning: string | null = null;
  const now = new Date();

  const captureDataError = (section: string) => (error: unknown) => {
    console.error('[dashboard] Falha ao carregar secao', { section, error: error instanceof Error ? error.message : 'Erro desconhecido' });
    dataWarning = 'Alguns dados nao puderam ser carregados agora. Tente atualizar a pagina.';
    return [];
  };

  const companies = admin && ['resumo', 'empresas', 'clientes', 'convites', 'solicitacoes'].includes(view) ? await prisma.company.findMany({ orderBy: { createdAt: 'desc' } }).catch(captureDataError('empresas')) : [];
  const clients = admin && ['resumo', 'clientes'].includes(view) ? await prisma.user.findMany({ where: { role: clientRoleFilter() }, include: { company: true }, orderBy: { createdAt: 'desc' } }).catch(captureDataError('clientes')) : [];
  const invitations = admin && ['resumo', 'convites'].includes(view) ? await prisma.invitationToken.findMany({ include: { company: true }, orderBy: { createdAt: 'desc' } }).catch(captureDataError('convites')) : [];
  const services = admin && ['resumo', 'servicos'].includes(view) ? await prisma.serviceCatalog.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }).catch(captureDataError('servicos')) : [];
  const requests = (!admin || ['resumo', 'solicitacoes'].includes(view)) ? await prisma.serviceRequest.findMany({ where: admin ? {} : { companyId: user.companyId ?? '__sem_empresa__' }, include: { company: true, requester: true, quotes: true }, orderBy: { createdAt: 'desc' } }).catch(captureDataError('solicitacoes')) : [];
  const warranties = (admin && ['resumo', 'garantias'].includes(view)) || !admin ? await prisma.warranty.findMany({ where: admin ? {} : { requesterId: user.id }, include: { company: true, requester: true, serviceRequest: true }, orderBy: [{ status: 'asc' }, { endDate: 'asc' }] }).catch(captureDataError('garantias')) : [];

  const pendingCollection = requests.filter((request) => request.currentStatus === 'AGUARDANDO_RECOLHIMENTO').length;
  const pendingApproval = requests.filter((request) => request.currentStatus === 'AGUARDANDO_APROVACAO').length;
  const activeClients = clients.filter((client) => client.active).length;
  const activeServices = services.filter((service) => service.active).length;
  const pendingInvites = invitations.filter((invitation) => !invitation.acceptedAt && invitation.expiresAt >= now).length;
  const activeWarranties = warranties.filter((warranty) => effectiveWarrantyStatus(warranty.status, warranty.endDate, now) === WarrantyStatus.ATIVA).length;

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div><h1 className="text-2xl font-bold">Painel {admin ? 'administrativo MD' : 'do cliente'}</h1><p className="text-sm text-slate-600">{admin ? 'Visão organizada por áreas do painel.' : `Empresa vinculada: ${user.company?.name ?? 'nao informada'}`}</p></div>
    {dataWarning ? <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{dataWarning}</p> : null}

    {admin ? <nav className="card flex flex-wrap gap-2 p-3">{views.map((item) => <Link key={item.key} href={item.key === 'resumo' ? '/dashboard' : `/dashboard?view=${item.key}`} className={`rounded-md px-4 py-2 text-sm font-semibold ${view === item.key ? 'bg-mdblue text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{item.label}</Link>)}</nav> : null}

    {admin && view === 'resumo' ? <section className="space-y-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><ResumoCard titulo="Solicitações" valor={requests.length} detalhe="Total" /><ResumoCard titulo="Aguard. recolhimento" valor={pendingCollection} detalhe="Pendentes" /><ResumoCard titulo="Aguard. aprovação" valor={pendingApproval} detalhe="Orçamentos" /><ResumoCard titulo="Garantias ativas" valor={activeWarranties} detalhe={`${warranties.length} cadastradas`} /><ResumoCard titulo="Clientes ativos" valor={activeClients} detalhe={`${clients.length} cadastrados`} /><ResumoCard titulo="Serviços ativos" valor={activeServices} detalhe={`${services.length} cadastrados`} /></div><section className="card"><div className="flex items-center justify-between"><h2 className="font-semibold">Últimas solicitações</h2><Link href="/dashboard?view=solicitacoes" className="text-sm font-semibold text-mdblue">Ver todas</Link></div><SolicitacoesTabela requests={requests.slice(0, 8)} companies={[]} /></section><section className="card"><div className="flex items-center justify-between"><h2 className="font-semibold">Garantias recentes</h2><Link href="/dashboard?view=garantias" className="text-sm font-semibold text-mdblue">Ver garantias</Link></div><GarantiasTabela warranties={warranties.slice(0, 6)} admin={admin} now={now} /></section><section className="grid gap-4 lg:grid-cols-2"><ResumoCard titulo="Convites pendentes" valor={pendingInvites} detalhe="Dentro do prazo" /><ResumoCard titulo="Empresas cadastradas" valor={companies.length} detalhe="Disponíveis no portal" /></section></section> : null}

    {admin && view === 'empresas' ? <section className="space-y-6"><section className="card"><h2 className="font-semibold">Cadastrar empresa</h2><form action={createCompanyAction} className="mt-4 grid gap-3 md:grid-cols-2"><input name="name" placeholder="Nome da empresa" required /><input name="document" placeholder="CNPJ ou documento" /><input name="email" type="email" placeholder="E-mail" /><input name="phone" placeholder="Telefone" /><button className="btn md:col-span-2">Salvar empresa</button></form></section><section className="card"><h2 className="font-semibold">Empresas cadastradas</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-b last:border-0"><td className="py-3 font-medium">{company.name}</td><td>{company.document ?? '-'}</td><td>{company.email ?? '-'}</td><td>{company.phone ?? '-'}</td><td><CompanyManagementForms company={{ id: company.id, name: company.name }} /></td></tr>)}</tbody></table>{companies.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma empresa cadastrada.</p> : null}</div></section></section> : null}

    {admin && view === 'convites' ? <section className="space-y-6"><section className="card"><h2 className="font-semibold">Convidar usuário</h2><DashboardInviteForm companies={companies.map((company) => ({ id: company.id, name: company.name }))} roles={roleOptions} /></section><ConvitesTabela invitations={invitations} now={now} /></section> : null}

    {admin && view === 'servicos' ? <section className="card"><h2 className="font-semibold">Serviços cadastrados</h2><ServiceCatalogForms services={services.map((service) => ({ id: service.id, name: service.name, description: service.description, category: service.category, defaultUnitCents: service.defaultUnitCents, active: service.active, createdAt: service.createdAt.toLocaleString('pt-BR') }))} /></section> : null}

    {admin && view === 'clientes' ? <section className="card"><h2 className="font-semibold">Clientes cadastrados</h2><div className="mt-4 space-y-4">{clients.map((client) => <div key={client.id} className="rounded-md border border-slate-200 p-3"><div className="grid gap-2 text-sm md:grid-cols-5"><div><span className="font-semibold">Nome</span><br />{client.name}</div><div><span className="font-semibold">E-mail</span><br />{client.email}</div><div><span className="font-semibold">Empresa</span><br />{client.company?.name ?? '-'}</div><div><span className="font-semibold">Status</span><br />{client.active ? 'ativo' : 'inativo'}</div><div><span className="font-semibold">Cadastro</span><br />{client.createdAt.toLocaleString('pt-BR')}<br /><span className="text-xs text-slate-500">Último acesso: não registrado</span></div></div><div className="mt-3"><ClientManagementForms client={{ id: client.id, name: client.name, email: client.email, companyId: client.companyId, active: client.active }} companies={companies.map((company) => ({ id: company.id, name: company.name }))} /></div></div>)}{clients.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhum cliente cadastrado.</p> : null}</div></section> : null}

    {admin && view === 'solicitacoes' ? <section className="card"><h2 className="font-semibold">Solicitações / acompanhamento</h2><SolicitacoesTabela requests={requests} companies={companies.map((company) => ({ id: company.id, name: company.name }))} /></section> : null}

    {admin && view === 'garantias' ? <section className="card"><h2 className="font-semibold">Garantias / acompanhamento</h2><GarantiasTabela warranties={warranties} admin={admin} now={now} /></section> : null}

    {!admin && canCreateRequest(user.role) ? <section className="card"><h2 className="font-semibold">Nova solicitação de recolhimento</h2><form action={createServiceRequestAction} className="mt-4 grid gap-3 md:grid-cols-2"><input name="setor" placeholder="Setor" required /><input name="responsavel" placeholder="Responsável" required /><input name="telefone" placeholder="Telefone" required /><input name="tipoAparelho" placeholder="Tipo de aparelho" required /><input name="marca" placeholder="Marca" required /><input name="modelo" placeholder="Modelo" required /><input name="serial" placeholder="IMEI ou número de série" required /><textarea name="problema" placeholder="Problema informado" required className="md:col-span-2" /><textarea name="observacoes" placeholder="Observações" className="md:col-span-2" /><button className="btn md:col-span-2">Abrir solicitação</button></form></section> : null}
    {!admin ? <section className="card"><h2 className="font-semibold">Minhas garantias</h2><GarantiasTabela warranties={warranties} admin={admin} now={now} /></section> : null}
    {!admin ? <section className="card"><h2 className="font-semibold">Solicitações / acompanhamento</h2><SolicitacoesTabela requests={requests} companies={[]} /></section> : null}
  </main>;
}

function ResumoCard({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe: string }) {
  return <div className="card"><p className="text-sm font-semibold text-slate-600">{titulo}</p><p className="mt-2 text-3xl font-bold text-mdgraphite">{valor}</p><p className="mt-1 text-xs text-slate-500">{detalhe}</p></div>;
}

function SolicitacoesTabela({ requests, companies }: { requests: Array<{ id: string; protocol: string; companyId: string; setor: string; responsavel: string; telefone: string; tipoAparelho: string; marca: string; modelo: string; serial: string; problema: string; observacoes: string | null; currentStatus: string; company: { name: string }; requester: { name: string } }>; companies: Array<{ id: string; name: string }> }) {
  return <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Protocolo</th><th>Empresa</th><th>Status</th><th>Solicitante</th><th></th></tr></thead><tbody>{requests.map((request) => <Fragment key={request.id}><tr className="border-b last:border-0"><td className="py-3 font-medium">{request.protocol}</td><td>{request.company.name}</td><td><span className="badge">{request.currentStatus}</span></td><td>{request.requester.name}</td><td><Link className="font-semibold text-mdblue" href={`/requests/${request.id}`}>Abrir</Link></td></tr>{companies.length > 0 ? <tr className="border-b"><td colSpan={5} className="py-3"><RequestManagementForms request={request} companies={companies} /></td></tr> : null}</Fragment>)}</tbody></table>{requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitação cadastrada.</p> : null}</div>;
}

function GarantiasTabela({ warranties, admin, now }: { warranties: Array<{ id: string; warrantyDays: number; startDate: Date; endDate: Date; status: WarrantyStatus; issueDescription: string | null; decisionNote: string | null; company: { name: string }; requester: { name: string }; serviceRequest: { id: string; protocol: string; tipoAparelho: string; marca: string; modelo: string } }>; admin: boolean; now: Date }) {
  return <div className="mt-4 space-y-4">{warranties.map((warranty) => {
    const status = effectiveWarrantyStatus(warranty.status, warranty.endDate, now);
    const canOpen = !admin && status === WarrantyStatus.ATIVA;
    return <div key={warranty.id} className="rounded-md border border-slate-200 p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-6">
        <div><span className="font-semibold">O.S.</span><br /><Link className="text-mdblue font-semibold" href={`/requests/${warranty.serviceRequest.id}`}>{warranty.serviceRequest.protocol}</Link></div>
        <div><span className="font-semibold">Cliente</span><br />{warranty.requester.name}</div>
        <div><span className="font-semibold">Empresa</span><br />{warranty.company.name}</div>
        <div><span className="font-semibold">Equipamento</span><br />{warranty.serviceRequest.tipoAparelho} {warranty.serviceRequest.marca} {warranty.serviceRequest.modelo}</div>
        <div><span className="font-semibold">Vencimento</span><br />{warranty.endDate.toLocaleDateString('pt-BR')}<br /><span className="text-xs text-slate-500">{warranty.warrantyDays} dias</span></div>
        <div><span className="font-semibold">Status</span><br /><span className="badge">{status}</span></div>
      </div>
      {warranty.issueDescription ? <p className="mt-3 rounded bg-slate-50 p-2"><strong>Solicitação:</strong> {warranty.issueDescription}</p> : null}
      {warranty.decisionNote ? <p className="mt-2 rounded bg-slate-50 p-2"><strong>Observação MD:</strong> {warranty.decisionNote}</p> : null}
      {admin ? <form action={updateWarrantyStatusAction} className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]"><input type="hidden" name="warrantyId" value={warranty.id} /><select name="status" defaultValue={warranty.status}>{Object.values(WarrantyStatus).map((item) => <option key={item} value={item}>{item}</option>)}</select><input name="decisionNote" placeholder="Observação da garantia" defaultValue={warranty.decisionNote ?? ''} /><button className="btn">Atualizar garantia</button></form> : null}
      {canOpen ? <form action={openWarrantyClaimAction} className="mt-3 grid gap-2"><input type="hidden" name="warrantyId" value={warranty.id} /><textarea name="issueDescription" placeholder="Descreva o problema apresentado para acionar a garantia" required /><button className="btn-secondary">Solicitar atendimento em garantia</button></form> : null}
    </div>;
  })}{warranties.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma garantia cadastrada.</p> : null}</div>;
}

function effectiveWarrantyStatus(status: WarrantyStatus, endDate: Date, now: Date) {
  if (status === WarrantyStatus.ATIVA && endDate < now) return WarrantyStatus.VENCIDA;
  return status;
}

function ConvitesTabela({ invitations, now }: { invitations: Array<{ id: string; name: string; email: string; role: UserRole; expiresAt: Date; acceptedAt: Date | null; plainToken: string | null; company: { name: string } | null }>; now: Date }) {
  return <section className="card"><h2 className="font-semibold">Convites pendentes</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>E-mail</th><th>Perfil</th><th>Empresa</th><th>Expira em</th><th>Status</th><th></th></tr></thead><tbody>{invitations.map((invitation) => { const status = invitation.acceptedAt ? 'aceito' : invitation.expiresAt < now ? 'expirado' : 'pendente'; const inviteLink = status === 'pendente' && invitation.plainToken ? `${appUrl()}/invite/${invitation.plainToken}` : null; return <tr key={invitation.id} className="border-b last:border-0"><td className="py-3 font-medium">{invitation.name}</td><td>{invitation.email}</td><td>{displayRole(invitation.role)}</td><td>{invitation.company?.name ?? '-'}</td><td>{invitation.expiresAt.toLocaleString('pt-BR')}</td><td><span className="badge">{status}</span></td><td>{inviteLink ? <CopyInviteLinkButton link={inviteLink} /> : status === 'pendente' ? <span className="text-xs text-slate-500">Link indisponível</span> : null}</td></tr>; })}</tbody></table>{invitations.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhum convite cadastrado.</p> : null}</div></section>;
}

function appUrl() {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
