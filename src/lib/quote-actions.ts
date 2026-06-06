'use server';

import type { ActionState } from '@/lib/actions';
import { createQuoteAction } from '@/lib/actions';

export async function createQuoteWithFeedbackAction(_previousState: ActionState, form: FormData): Promise<ActionState> {
  try {
    await createQuoteAction(form);
    return { status: 'success', message: 'Orçamento gerado e enviado para os clientes ativos da empresa.' };
  } catch (error) {
    console.error('[quote] Falha ao gerar ou enviar orçamento', { error: errorMessage(error) });
    return { status: 'error', message: 'Não foi possível gerar e enviar o orçamento. Verifique os dados e tente novamente.' };
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}
