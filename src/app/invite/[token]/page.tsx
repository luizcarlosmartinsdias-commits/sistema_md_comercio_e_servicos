import Link from 'next/link';
import { InviteAcceptForm } from '@/components/invite-accept-form';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invitation = await findInvitation(params.token);

  if (!invitation) {
    return <InviteMessage title="Convite invalido" message="Este link de convite nao foi encontrado. Solicite um novo convite ao administrador." />;
  }

  if (invitation.acceptedAt) {
    return <InviteMessage title="Convite ja aceito" message="Este convite ja foi usado. Acesse a tela de login para entrar no Portal MD." showLogin />;
  }

  if (invitation.expiresAt < new Date()) {
    return <InviteMessage title="Convite expirado" message="Este convite expirou. Solicite um novo convite ao administrador." />;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <section className="card">
        <h1 className="text-xl font-semibold">Ativar acesso</h1>
        <p className="mt-2 text-sm text-slate-600">Crie sua senha para acessar o Portal MD como {invitation.email}.</p>
        <InviteAcceptForm token={params.token} />
      </section>
    </main>
  );
}

async function findInvitation(token: string) {
  if (!token) return null;

  try {
    return await prisma.invitationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  } catch (error) {
    console.error('[invite] Falha ao carregar convite', { tokenFingerprint: hashToken(token).slice(0, 12), error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return null;
  }
}

function InviteMessage({ title, message, showLogin = false }: { title: string; message: string; showLogin?: boolean }) {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <section className="card">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {showLogin ? <Link href="/login" className="btn mt-5 inline-flex">Ir para login</Link> : null}
      </section>
    </main>
  );
}
