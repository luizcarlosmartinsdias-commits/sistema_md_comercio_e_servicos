'use server';

import type { ActionState } from '@/lib/actions';
import { createQuoteAction } from '@/lib/actions';

type QuoteActionResult = { emailResult?: { sent: number; failed: number; totalRecipients: number; recipients: string[] } } | void;

export async function createQuoteWithFeedbackAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    const result = await createQuoteAction(form) as QuoteActionResult;
    const emailResult = result?.emailResult;

    if (!emailResult) return { status: 'success', message: 'Orçamento gerado. Verifique o histórico da solicitação para confirmar o envio por e-mail.' };
    if (emailResult.totalRecipients === 0) return { status: 'warning', message: 'Orçamento gerado, mas não há destinatário com e-mail cadastrado para esta empresa.' };
    if (emailResult.sent > 0 && emailResult.failed === 0) return { status: 'success', message: `Orçamento gerado e enviado para ${emailResult.sent} destinatário(s).` };
    if (emailResult.sent > 0) return { status: 'warning', message: `Orçamento gerado. Enviado para ${emailResult.sent} destinatário(s), com falha para ${emailResult.failed}.` };
    return { status: 'warning', message: 'Orçamento gerado, mas houve falha no envio do e-mail.' };
  } catch (error) {
    console.error('[quote] Falha ao gerar ou enviar orçamento', { error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível gerar e enviar o orçamento. Verifique os dados e tente novamente.' };
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
