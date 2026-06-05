import { resetPasswordAction } from '@/lib/actions';

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return <main className="mx-auto max-w-md px-4 py-10"><section className="card"><h1 className="text-xl font-semibold">Criar nova senha</h1><form action={resetPasswordAction} className="mt-5 space-y-4"><input type="hidden" name="token" value={params.token} /><div><label>Nova senha</label><input name="password" type="password" minLength={8} required /></div><button className="btn w-full">Salvar senha</button></form></section></main>;
}
