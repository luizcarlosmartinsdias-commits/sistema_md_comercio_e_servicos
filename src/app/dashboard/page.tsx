import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { DashboardInviteForm } from '@/components/dashboard-invite-form';
import { CopyInviteLinkButton } from '@/components/copy-invite-link-button';
import { ClientManagementForms } from '@/components/client-management-forms';
import { CompanyManagementForms } from '@/components/company-management-forms';
import { ServiceCatalogForms } from '@/components/service-catalog-forms';
import { RequestManagementForms } from '@/components/request-management-forms';
import { NewServiceRequestForm } from '@/components/new-service-request-form';
import { requireSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createCompanyAction } from '@/lib/actions';
import { canCreateRequest, clientRoleFilter, displayRole, isAdmin } from '@/lib/rbac';

const roleOptions = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: UserRole.ADMIN_MD, label: 'Administrador MD' }
];

const views = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'solicitacoes', label: 'Solicitações' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'convites', label: 'Convites' },
  { key: 'servicos', label: 'Serviços' }
];

export default async function DashboardPage({ searchParams }: { searchParams?: { view?: string } }) {
  const user = await requireSessionUser();
  const admin = isAdmin(user.role);
  const view = views.some((item) => item.key === searchParams?.view) ? String(searchParams?.view) : 'resumo';

  if (!admin) {
    let requests: Array<{ id: string; protocol: string; currentStatus: string; company: { name: string }; requester: { name: string } }> = [];
    try {
      requests = await prisma.serviceRequest.findMany({
        where: { requesterId: user.id },
        include: { company: true, requester: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('[dashboard-client] Falha ao carregar solicitações', error);
    }

    return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div><h1 className="text-2xl font-bold">Painel do cliente</h1><p className="text-sm text-slate-600">Abra e acompanhe somente as suas próprias O.S.</p></div>
      {canCreateRequest(user.role) ? <section className="card"><h2 className="font-semibold">Nova solicitação de recolhimento</h2><div className="mt-4"><NewServiceRequestForm /></div></section> : null}
      <section className="card"><h2 className="font-semibold">Minhas solicitações</h2><SolicitacoesTabela requests={requests} companies={[]} /></section>
    </main>;
  }

  let companies: Awaited<ReturnType<typeof prisma.company.findMany>> = [];
  let clients: Awaited<ReturnType<typeof prisma.user.findMany>> = [];
  let invitations: Awaited<ReturnType<typeof prisma.invitationToken.findMany>> = [];
  let services: Awaited<ReturnType<typeof prisma.serviceCatalog.findMany>> = [];
  let requests: Array<{ id: string; protocol: string; companyId: string; setor: string; responsavel: string; telefone: string; tipoAparelho: string; marca: string; modelo: string; serial: string; problema: string; observacoes: string | null; currentStatus: string; company: { name: string }; requester: { name: string } }> = [];

  try {
    if (['resumo', 'empresas', 'clientes', 'convites', 'solicitacoes'].includes(view)) companies = await prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
    if (['resumo', 'clientes'].includes(view)) clients = await prisma.user.findMany({ where: { role: clientRoleFilter() }, include: { company: true }, orderBy: { createdAt: 'desc' } });
    if (['resumo', 'convites'].includes(view)) invitations = await prisma.invitationToken.findMany({ include: { company: true }, orderBy: { createdAt: 'desc' } });
    if (['resumo', 'servicos'].includes(view)) services = await prisma.serviceCatalog.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] });
    if (['resumo', 'solicitacoes'].includes(view)) requests = await prisma.serviceRequest.findMany({ include: { company: true, requester: true }, orderBy: { createdAt: 'desc' } });
  } catch (error) {
    console.error('[dashboard-admin] Falha ao carregar dados', error);
  }

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div><h1 className="text-2xl font-bold">Painel administrativo MD</h1><p className="text-sm text-slate-600">Visão organizada por áreas do painel.</p></div>
    <nav className="card flex flex-wrap gap-2 p-3">{views.map((item) => <Link key={item.key} href={item.key === 'resumo' ? '/dashboard' : `/dashboard?view=${item.key}`} className={`rounded-md px-4 py-2 text-sm font-semibold ${view === item.key ? 'bg-mdblue text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{item.label}</Link>)}<Link href="/invoices" className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Notas fiscais</Link></nav>
    {view === 'resumo' ? <section className="grid gap-4 md:grid-cols-4"><ResumoCard titulo="Solicitações" valor={requests.length} detalhe="Total" /><ResumoCard titulo="Clientes" valor={clients.length} detalhe="Cadastrados" /><ResumoCard titulo="Empresas" valor={companies.length} detalhe="Cadastradas" /><ResumoCard titulo="Serviços" valor={services.length} detalhe="Cadastrados" /></section> : null}
    {view === 'empresas' ? <section className="space-y-6"><section className="card"><h2 className="font-semibold">Cadastrar empresa</h2><form action={createCompanyAction} className="mt-4 grid gap-3 md:grid-cols-2"><input name="name" placeholder="Nome da empresa" required /><input name="document" placeholder="CNPJ ou documento" /><input name="email" type="email" placeholder="E-mail" /><input name="phone" placeholder="Telefone" /><button className="btn md:col-span-2">Salvar empresa</button></form></section><section className="card"><h2 className="font-semibold">Empresas cadastradas</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-b last:border-0"><td className="py-3 font-medium">{company.name}</td><td>{company.document ?? '-'}</td><td>{company.email ?? '-'}</td><td>{company.phone ?? '-'}</td><td><CompanyManagementForms company={{ id: company.id, name: company.name }} /></td></tr>)}</tbody></table></div></section></section> : null}
    {view === 'convites' ? <section className="space-y-6"><section className="card"><h2 className="font-semibold">Convidar usuário</h2><DashboardInviteForm companies={companies.map((company) => ({ id: company.id, name: company.name }))} roles={roleOptions} /></section><ConvitesTabela invitations={invitations} /></section> : null}
    {view === 'servicos' ? <section className="card"><h2 className="font-semibold">Serviços cadastrados</h2><ServiceCatalogForms services={services.map((service) => ({ id: service.id, name: service.name, description: service.description, category: service.category, defaultUnitCents: service.defaultUnitCents, active: service.active, createdAt: service.createdAt.toLocaleString('pt-BR') }))} /></section> : null}
    {view === 'clientes' ? <section className="card"><h2 className="font-semibold">Clientes cadastrados</h2><div className="mt-4 space-y-4">{clients.map((client: any) => <div key={client.id} className="rounded-md border border-slate-200 p-3"><div className="grid gap-2 text-sm md:grid-cols-5"><div><span className="font-semibold">Nome</span><br />{client.name}</div><div><span className="font-semibold">E-mail</span><br />{client.email}</div><div><span className="font-semibold">Empresa</span><br />{client.company?.name ?? '-'}</div><div><span className="font-semibold">Status</span><br />{client.active ? 'ativo' : 'inativo'}</div><div><span className="font-semibold">Cadastro</span><br />{client.createdAt.toLocaleString('pt-BR')}</div></div><div className="mt-3"><ClientManagementForms client={{ id: client.id, name: client.name, email: client.email, companyId: client.companyId, active: client.active }} companies={companies.map((company) => ({ id: company.id, name: company.name }))} /></div></div>)}</div></section> : null}
    {view === 'solicitacoes' || view === 'resumo' ? <section className="card"><h2 className="font-semibold">Solicitações / acompanhamento</h2><SolicitacoesTabela requests={requests} companies={companies.map((company) => ({ id: company.id, name: company.name }))} /></section> : null}
  </main>;
}

function ResumoCard({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe: string }) { return <div className="card"><p className="text-sm font-semibold text-slate-600">{titulo}</p><p className="mt-2 text-3xl font-bold text-mdgraphite">{valor}</p><p className="mt-1 text-xs text-slate-500">{detalhe}</p></div>; }
function SolicitacoesTabela({ requests, companies }: { requests: Array<{ id: string; protocol: string; currentStatus: string; company: { name: string }; requester: { name: string } }>; companies: Array<{ id: string; name: string }> }) { return <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Protocolo</th><th>Empresa</th><th>Status</th><th>Solicitante</th><th></th></tr></thead><tbody>{requests.map((request: any) => <tr key={request.id} className="border-b last:border-0"><td className="py-3 font-medium">{request.protocol}</td><td>{request.company.name}</td><td><span className="badge">{request.currentStatus}</span></td><td>{request.requester.name}</td><td><Link className="font-semibold text-mdblue" href={`/requests/${request.id}`}>Abrir</Link>{companies.length > 0 ? <div className="mt-2"><RequestManagementForms request={request} companies={companies} /></div> : null}</td></tr>)}</tbody></table>{requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitação cadastrada.</p> : null}</div>; }
function ConvitesTabela({ invitations }: { invitations: Array<any> }) { const now = new Date(); return <section className="card"><h2 className="font-semibold">Convites pendentes</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Nome</th><th>E-mail</th><th>Perfil</th><th>Empresa</th><th>Expira em</th><th>Status</th><th></th></tr></thead><tbody>{invitations.map((invitation) => { const status = invitation.acceptedAt ? 'aceito' : invitation.expiresAt < now ? 'expirado' : 'pendente'; const inviteLink = status === 'pendente' && invitation.plainToken ? `${appUrl()}/invite/${invitation.plainToken}` : null; return <tr key={invitation.id} className="border-b last:border-0"><td className="py-3 font-medium">{invitation.name}</td><td>{invitation.email}</td><td>{displayRole(invitation.role)}</td><td>{invitation.company?.name ?? '-'}</td><td>{invitation.expiresAt.toLocaleString('pt-BR')}</td><td><span className="badge">{status}</span></td><td>{inviteLink ? <CopyInviteLinkButton link={inviteLink} /> : null}</td></tr>; })}</tbody></table></div></section>; }
function appUrl() { return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''); }
