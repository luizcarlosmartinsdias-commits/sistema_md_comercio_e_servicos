import { acceptInvitationAction } from '@/lib/actions';

export default function InvitePage({ params }: { params: { token: string } }) {
  return <main className="mx-auto max-w-md px-4 py-10"><section className="card"><h1 className="text-xl font-semibold">Ativar acesso</h1><p className="mt-2 text-sm text-slate-600">Crie sua senha para acessar o Portal MD.</p><form action={acceptInvitationAction} className="mt-5 space-y-4"><input type="hidden" name="token" value={params.token} /><div><label>Senha</label><input name="password" type="password" minLength={8} required /></div><button className="btn w-full">Criar senha</button></form></section></main>;
}
