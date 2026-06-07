'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { ActionState } from '@/lib/actions';
import { resendLatestQuotePdfAction } from '@/lib/quote-actions';

const initialState: ActionState = { status: 'idle', message: '' };

export function ResendQuoteEmailForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useFormState(resendLatestQuotePdfAction, initialState);
  const messageClass = state.status === 'success' ? 'text-green-700' : state.status === 'warning' ? 'text-amber-700' : 'text-red-600';

  return (
    <form action={formAction} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton />
      {state.message ? <p className={`text-sm ${messageClass}`} role="status">{state.message}</p> : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="btn-secondary" type="submit" disabled={pending}>{pending ? 'Reenviando PDF...' : 'Reenviar PDF por e-mail'}</button>;
}
