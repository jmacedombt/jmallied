/**
 * Sistema Allied é só pro Brasil — toda data/hora exibida na tela tem que
 * ser sempre no horário de Brasília, independente de onde o código roda
 * (o servidor da Vercel roda em UTC; o navegador do usuário pode estar
 * configurado em outro fuso). As funções abaixo fixam o fuso
 * explicitamente na hora de formatar, em vez de confiar no fuso "local"
 * implícito do ambiente que executa o código.
 *
 * Só valem pra valores que já carregam hora de verdade (timestamptz do
 * Supabase, tipo "criado_em", "importado_em", "valor_enviado_em"). Pra
 * colunas `date` sem hora nenhuma (ex: data_reconhecimento, data_compra),
 * NÃO usar essas funções — usar formatarDataBr de "@/lib/pecas", que
 * trabalha só com o texto "aaaa-mm-dd" e não depende de fuso nenhum
 * (aplicar fuso num valor sem hora pode até fazer o dia mostrado mudar).
 */
export const FUSO_BRASILIA = "America/Sao_Paulo";

/** Data e hora completas, no fuso de Brasília — ex: "05/09/2026 20:17:22". */
export function formatarDataHoraBrasilia(valor: string | number | Date): string {
  return new Date(valor).toLocaleString("pt-BR", { timeZone: FUSO_BRASILIA });
}

/** Só a data (de um valor com hora), no fuso de Brasília — ex: "05/09/2026". */
export function formatarDataBrasilia(valor: string | number | Date): string {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: FUSO_BRASILIA });
}

/** Só a hora, no fuso de Brasília — ex: "20:17:22". */
export function formatarHoraBrasilia(valor: string | number | Date): string {
  return new Date(valor).toLocaleTimeString("pt-BR", { timeZone: FUSO_BRASILIA });
}
