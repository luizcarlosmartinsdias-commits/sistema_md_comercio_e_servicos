import Link from 'next/link';
import { requestPasswordResetAction } from '@/lib/actions';

export default function ForgotPasswordPage() {
  return <main className="mx-auto max-w-md px-4 py-10"><section className="card"><h1 className="text-xl font-semibold">Redefinir senha</h1><form action={requestPasswordResetAction} className="mt-5 space-y-4"><div><label>E-mail</label><input name="email" type="email" required /></div><button className="btn w-full">Enviar link</button></form><Link className="mt-4 inline-block text-sm text-mdblue" href="/login">Voltar ao login</Link></section></main>;
}
