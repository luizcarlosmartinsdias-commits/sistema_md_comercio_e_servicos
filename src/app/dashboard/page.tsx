import Link from 'next/link';
import { requireSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createCompanyAction, createServiceRequestAction, inviteUserAction } from '@/lib/actions';
import { isAdmin, canCreateRequest } from '@/lib/rbac';
import { UserRole } from '@prisma/client';

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const admin = isAdmin(user.role);
  const [companies, requests] = await Promise.all([
    admin ? prisma.company.findMany({ orderBy: { createdAt: 'desc' } }) : [],
    prisma.serviceRequest.findMany({ where: admin ? {} : { companyId: user.companyId ?? '' }, include: { company: true, requester: true, quotes: true }, orderBy: { createdAt: 'desc' } })
  ]);

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div><h1 className="text-2xl font-bold">Painel {admin ? 'administrativo MD' : 'do cliente'}</h1><p className="text-sm text-slate-600">{admin ? 'Visao completa de empresas, convites e solicitacoes.' : `Empresa vinculada: ${user.company?.name ?? 'nao informada'}`}</p></div>
    {admin ? <section className="grid gap-4 lg:grid-cols-2"><div className="card"><h2 className="font-semibold">Cadastrar empresa</h2><form action={createCompanyAction} className="mt-4 grid gap-3"><input name="name" placeholder="Nome da empresa" required /><input name="document" placeholder="CNPJ ou documento" /><input name="email" type="email" placeholder="E-mail" /><input name="phone" placeholder="Telefone" /><button className="btn">Salvar empresa</button></form></div><div className="card"><h2 className="font-semibold">Convidar usuario</h2><form action={inviteUserAction} className="mt-4 grid gap-3"><input name="name" placeholder="Nome" required /><input name="email" type="email" placeholder="E-mail" required /><select name="role" required><option value={UserRole.CLIENTE_SOLICITANTE}>Cliente solicitante</option><option value={UserRole.CLIENTE_GESTOR}>Cliente gestor</option><option value={UserRole.CLIENTE_FINANCEIRO}>Cliente financeiro</option><option value={UserRole.ADMIN_MD}>Administrador MD</option></select><select name="companyId"><option value="">Sem empresa / administrador</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn">Enviar convite</button></form></div></section> : null}
    {canCreateRequest(user.role) ? <section className="card"><h2 className="font-semibold">Nova solicitacao de recolhimento</h2><form action={createServiceRequestAction} className="mt-4 grid gap-3 md:grid-cols-2"><input name="setor" placeholder="Setor" required /><input name="responsavel" placeholder="Responsavel" required /><input name="telefone" placeholder="Telefone" required /><input name="tipoAparelho" placeholder="Tipo de aparelho" required /><input name="marca" placeholder="Marca" required /><input name="modelo" placeholder="Modelo" required /><input name="serial" placeholder="IMEI ou numero de serie" required /><textarea name="problema" placeholder="Problema informado" required className="md:col-span-2" /><textarea name="observacoes" placeholder="Observacoes" className="md:col-span-2" /><button className="btn md:col-span-2">Abrir solicitacao</button></form></section> : null}
    <section className="card"><h2 className="font-semibold">Solicitacoes</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Protocolo</th><th>Empresa</th><th>Status</th><th>Solicitante</th><th></th></tr></thead><tbody>{requests.map((request) => <tr key={request.id} className="border-b last:border-0"><td className="py-3 font-medium">{request.protocol}</td><td>{request.company.name}</td><td><span className="badge">{request.currentStatus}</span></td><td>{request.requester.name}</td><td><Link className="text-mdblue font-semibold" href={`/requests/${request.id}`}>Abrir</Link></td></tr>)}</tbody></table>{requests.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhuma solicitacao cadastrada.</p> : null}</div></section>
  </main>;
}
