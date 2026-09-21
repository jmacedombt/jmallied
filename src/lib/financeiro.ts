import type { SupabaseClient } from "@supabase/supabase-js";

// quem acessa o módulo Financeiro (pedido explícito): Administrador
// (is_master), Gerente (mesma trava já usada em ações sensíveis como
// Retroceder Etapa) e o cargo dedicado "Financeiro" (ver migration
// 0055) — os 3 juntos, não um no lugar do outro.
export const CARGOS_FINANCEIRO = ["Gerente", "Financeiro"] as const;

export function podeAcessarFinanceiro(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  if (perfil.is_master) return true;
  return (CARGOS_FINANCEIRO as readonly string[]).includes(perfil.cargo);
}

export type StatusFinanceiro = "Em Aberto" | "Vlr. Recebido";

export type LinhaFinanceiro = {
  id: string;
  dataEmissao: string;
  nfMaoDeObraNumero: string | null;
  nfMaoDeObraValor: number | null;
  nfPecasNumero: string | null;
  nfPecasValor: number | null;
  status: StatusFinanceiro;
  dataRecebimento: string | null;
};

/** "aaaa-mm-dd" de hoje, sempre no fuso de Brasília — usado tanto pra
 * decidir em qual lançamento do dia encaixar uma NF nova (ver
 * registrarLancamentoFinanceiro abaixo) quanto como padrão de "Data de
 * Recebimento" ao marcar como Vlr. Recebido. */
export function hojeIso(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const ano = partes.find((p) => p.type === "year")?.value ?? "1970";
  const mes = partes.find((p) => p.type === "month")?.value ?? "01";
  const dia = partes.find((p) => p.type === "day")?.value ?? "01";
  return `${ano}-${mes}-${dia}`;
}

/** "aaaa-mm-01" dos últimos `n` meses (o mais antigo primeiro, terminando
 * no mês atual) — base fixa dos 2 gráficos de evolução (sempre 12
 * meses, mesmo pra mês sem nenhum lançamento, que aparece com R$ 0,00). */
export function ultimosNMeses(n: number): string[] {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const anoAtual = Number(partes.find((p) => p.type === "year")?.value ?? "1970");
  const mesAtual = Number(partes.find((p) => p.type === "month")?.value ?? "1");

  const resultado: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const totalMeses = anoAtual * 12 + (mesAtual - 1) - i;
    const ano = Math.floor(totalMeses / 12);
    const mes = (totalMeses % 12) + 1;
    resultado.push(`${ano}-${String(mes).padStart(2, "0")}-01`);
  }
  return resultado;
}

/** Soma um conjunto de {data (aaaa-mm-dd), valor} por mês (chave
 * "aaaa-mm-01") — usado pra montar os pontos dos 2 gráficos a partir das
 * linhas já carregadas (ver financeiro/page.tsx). */
export function somarValorPorMes(linhas: { data: string; valor: number }[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const l of linhas) {
    const mes = `${l.data.slice(0, 7)}-01`;
    mapa[mes] = (mapa[mes] ?? 0) + l.valor;
  }
  return mapa;
}

export async function buscarNotasFiscaisFinanceiro(supabase: SupabaseClient): Promise<LinhaFinanceiro[]> {
  const { data, error } = await supabase
    .from("financeiro_notas_fiscais")
    .select(
      "id, data_emissao, nf_mao_de_obra_numero, nf_mao_de_obra_valor, nf_pecas_numero, nf_pecas_valor, status, data_recebimento"
    )
    .order("data_emissao", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    dataEmissao: l.data_emissao as string,
    nfMaoDeObraNumero: (l.nf_mao_de_obra_numero as string | null) ?? null,
    nfMaoDeObraValor: l.nf_mao_de_obra_valor == null ? null : Number(l.nf_mao_de_obra_valor),
    nfPecasNumero: (l.nf_pecas_numero as string | null) ?? null,
    nfPecasValor: l.nf_pecas_valor == null ? null : Number(l.nf_pecas_valor),
    status: l.status as StatusFinanceiro,
    dataRecebimento: (l.data_recebimento as string | null) ?? null,
  }));
}

/**
 * Chamado (best-effort, nunca lança erro pro chamador) toda vez que uma
 * NF Mão de Obra ou NF Peças é lançada em Ag. Emissão de Nota Fiscal
 * (ver salvar-nf/route.ts) — pedido explícito: o Financeiro "recebe"
 * esse dado sozinho, sem precisar digitar de novo.
 *
 * Regra combinada com o Rafael: as duas NFs normalmente saem no mesmo
 * dia, então isso procura um lançamento já criado HOJE (qualquer um,
 * não só um com esse campo vazio — lançar de novo no mesmo dia CORRIGE
 * o valor, mesmo padrão já usado no histórico de ICMS) e completa/
 * corrige o campo dessa NF nele; se não achar nenhum de hoje, cria uma
 * linha nova só com esse campo preenchido (a outra NF entra depois,
 * nesse mesmo dia, e junta aqui — ou fica pendente de completar na mão
 * em /financeiro, se saiu em outro dia).
 */
export async function registrarLancamentoFinanceiro(
  admin: SupabaseClient,
  params: { tipo: "mao_de_obra" | "pecas"; numero: string; valor: number }
): Promise<void> {
  const campoNumero = params.tipo === "mao_de_obra" ? "nf_mao_de_obra_numero" : "nf_pecas_numero";
  const campoValor = params.tipo === "mao_de_obra" ? "nf_mao_de_obra_valor" : "nf_pecas_valor";
  const hoje = hojeIso();

  const { data: existente } = await admin
    .from("financeiro_notas_fiscais")
    .select("id")
    .eq("data_emissao", hoje)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    await admin
      .from("financeiro_notas_fiscais")
      .update({ [campoNumero]: params.numero, [campoValor]: params.valor, atualizado_em: new Date().toISOString() })
      .eq("id", existente.id);
    return;
  }

  await admin.from("financeiro_notas_fiscais").insert({
    data_emissao: hoje,
    [campoNumero]: params.numero,
    [campoValor]: params.valor,
  });
}
