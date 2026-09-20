import type { SupabaseClient } from "@supabase/supabase-js";

/** Formata um percentual de ICMS pro padrão de exibição do sistema (2
 * casas decimais + "%") — usado tanto na tabela de histórico (server,
 * chamada direto) quanto no gráfico de evolução (GraficoEvolucaoIcms.tsx,
 * client, chamada por dentro do componente — nunca passada como prop de
 * Server pra Client Component, senão o Next quebra em produção: "Functions
 * cannot be passed directly to Client Components"). */
export function formatarIcms(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * "aaaa-mm-01" do mês atual, sempre no fuso de Brasília — mesma
 * convenção de mês usada em configuracoes_impostos_historico (ver
 * migration 0054): uma linha por mês, upsert quando salva de novo
 * dentro do mesmo mês (ver api/configuracoes/impostos/route.ts).
 */
export function mesAtualIso(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")?.value ?? "1970";
  const mes = partes.find((p) => p.type === "month")?.value ?? "01";
  return `${ano}-${mes}-01`;
}

export type PontoIcmsHistorico = {
  mes: string;
  icmsPercentual: number;
  atualizadoEm: string;
  atualizadoPorNome: string | null;
};

export type ResultadoHistoricoIcms = {
  pontos: PontoIcmsHistorico[];
  /** preenchido quando a consulta falha — normalmente porque a migration
   * 0054 (tabela configuracoes_impostos_historico) ainda não foi rodada
   * no Supabase. Nunca lança erro: a tela de Configurações > Imposto
   * continua funcionando (formulário de ICMS normal), só sem o
   * gráfico/tabela de histórico, com esse aviso — ver
   * configuracoes/impostos/page.tsx. */
  erro: string | null;
};

/**
 * Histórico mensal do ICMS (ver migration 0054), do mais antigo pro mais
 * recente — já no formato pronto pro gráfico de evolução
 * (GraficoLinhaGradiente) e pra tabela de auditoria, ambos em
 * configuracoes/impostos/page.tsx.
 */
export async function buscarHistoricoIcms(supabase: SupabaseClient): Promise<ResultadoHistoricoIcms> {
  const { data, error } = await supabase
    .from("configuracoes_impostos_historico")
    .select("mes, icms_percentual, atualizado_em, usuarios:atualizado_por (nome, sobrenome)")
    .order("mes", { ascending: true });

  if (error) {
    return { pontos: [], erro: error.message };
  }

  const pontos = ((data ?? []) as Record<string, unknown>[]).map((l) => {
    const usuario = l.usuarios as { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
    const nomeUsuario = Array.isArray(usuario) ? usuario[0] : usuario;
    return {
      mes: l.mes as string,
      icmsPercentual: Number(l.icms_percentual),
      atualizadoEm: l.atualizado_em as string,
      atualizadoPorNome: nomeUsuario ? `${nomeUsuario.nome} ${nomeUsuario.sobrenome}` : null,
    };
  });

  return { pontos, erro: null };
}
