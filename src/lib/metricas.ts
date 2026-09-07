/**
 * Menu Métricas (Volumetria / R-TAT) — apoiado no histórico de
 * status_operacional gravado automaticamente pelo trigger
 * trg_orcamentos_historico_status (ver migration
 * 0022_metricas_historico_status.sql) e na Data Reconhecimento de cada
 * aparelho (orcamentos.data_reconhecimento), que é sempre o "dia zero"
 * usado pra calcular R-TAT.
 */
import { STATUS_OPERACIONAL, STATUS_ORCAMENTO_FECHADOS } from "@/lib/orcamentos";

export type Granularidade = "dia" | "semana" | "mes";

export const OPCOES_GRANULARIDADE: { valor: Granularidade; label: string }[] = [
  { valor: "dia", label: "Dia" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
];

// nunca passar o valor em português direto pra uma função RPC — o
// Postgres date_trunc só entende as unidades em inglês.
const UNIDADE_POSTGRES: Record<Granularidade, "day" | "week" | "month"> = {
  dia: "day",
  semana: "week",
  mes: "month",
};

export function unidadePostgres(g: Granularidade): "day" | "week" | "month" {
  return UNIDADE_POSTGRES[g];
}

export function granularidadeValida(valor: unknown): valor is Granularidade {
  return valor === "dia" || valor === "semana" || valor === "mes";
}

// janela padrão de cada agrupamento quando o usuário não escolhe um
// período customizado — dá um gráfico com uma quantidade razoável de
// pontos (nem 2, nem 300).
const DIAS_JANELA_PADRAO: Record<Granularidade, number> = {
  dia: 30,
  semana: 12 * 7, // 12 semanas
  mes: 365, // 12 meses
};

/** "aaaa-mm-dd" de uma Date, sempre pela data LOCAL do objeto (nunca
 * toISOString/UTC — o servidor roda em UTC, e "hoje" em UTC pode já ser
 * amanhã em Brasília perto da meia-noite). Use com Date já ajustada pro
 * fuso certo (ver hojeBrasiliaIso). */
function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje (só "aaaa-mm-dd") no fuso de Brasília — igual ao que o
 * Postgres vai gravar em data_reconhecimento pra um evento de agora,
 * mesmo rodando num servidor em UTC (Vercel). */
export function hojeBrasiliaIso(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return paraIsoLocal(d);
}

/** Intervalo [início, fim] (strings "aaaa-mm-dd") padrão pra uma granularidade, terminando hoje (Brasília). */
export function intervaloPadrao(g: Granularidade): { inicio: string; fim: string } {
  const fim = hojeBrasiliaIso();
  return { inicio: somarDias(fim, -DIAS_JANELA_PADRAO[g]), fim };
}

const DATA_ISO_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

export function dataIsoValida(valor: unknown): valor is string {
  return typeof valor === "string" && DATA_ISO_VALIDA.test(valor);
}

function inicioDaSemanaIso(data: Date): Date {
  const d = new Date(data);
  const diaSemana = d.getDay() || 7; // domingo (0) vira 7
  d.setDate(d.getDate() - (diaSemana - 1)); // volta pra segunda-feira
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Gera a sequência de períodos ("aaaa-mm-dd" de cada início de bucket)
 * entre início e fim pra uma granularidade — usado pra completar com
 * zero os buckets que o banco não devolveu (nenhum evento naquele
 * período), senão o gráfico teria "buracos" na linha do tempo. Alinhado
 * com o mesmo critério do date_trunc(...) do Postgres usado nas funções
 * RPC (semana começa na segunda, igual ISO-8601). */
export function gerarSequenciaPeriodos(inicioIso: string, fimIso: string, g: Granularidade): string[] {
  const fim = new Date(`${fimIso}T00:00:00`);
  let cursor: Date;
  if (g === "dia") {
    cursor = new Date(`${inicioIso}T00:00:00`);
  } else if (g === "semana") {
    cursor = inicioDaSemanaIso(new Date(`${inicioIso}T00:00:00`));
  } else {
    const d = new Date(`${inicioIso}T00:00:00`);
    cursor = new Date(d.getFullYear(), d.getMonth(), 1);
  }

  const periodos: string[] = [];
  let guarda = 0;
  while (cursor <= fim && guarda < 2000) {
    periodos.push(paraIsoLocal(cursor));
    if (g === "dia") cursor.setDate(cursor.getDate() + 1);
    else if (g === "semana") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
    guarda++;
  }
  return periodos;
}

/** Preenche com quantidade 0 os períodos que não vieram no resultado do
 * banco (nenhum evento naquele bucket), pra série ficar contínua. */
export function completarSerie(pontos: PontoPeriodo[], periodos: string[]): PontoPeriodo[] {
  const mapa = new Map(pontos.map((p) => [p.periodo, p.quantidade]));
  return periodos.map((periodo) => ({ periodo, quantidade: mapa.get(periodo) ?? 0 }));
}

/** Número da semana ISO-8601 (segunda-feira como início) — igual ao que
 * o Postgres usa em date_trunc('week', ...), pra bater certinho com o
 * agrupamento que já vem do banco. Mesma conta já usada em
 * GraficoPecasPorPeriodo.tsx. */
function semanaIso(data: Date): number {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaSemana = d.getUTCDay() || 7; // domingo (0) vira 7
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

/** Rótulo de um período (string "aaaa-mm-dd" vinda do banco) pro eixo do
 * gráfico — "W34" pra semana, "05/09" pro dia, "set/26" pro mês. */
export function formatarRotuloPeriodo(periodoIso: string, g: Granularidade): string {
  const d = new Date(`${periodoIso}T00:00:00`);
  if (g === "mes") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  }
  if (g === "semana") {
    return `W${semanaIso(d)}`;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function labelStatus(valor: string): string {
  return STATUS_OPERACIONAL.find((s) => s.valor === valor)?.label ?? valor;
}

export function statusEhFechado(valor: string): boolean {
  return (STATUS_ORCAMENTO_FECHADOS as readonly string[]).includes(valor);
}

// ---- formatos que voltam das funções RPC (ver migration 0022) ----

export type PontoPeriodo = { periodo: string; quantidade: number };
export type PontoPeriodoStatus = { periodo: string; status: string; quantidade: number };
export type PontoRTatTotal = { periodo: string; tat_medio_dias: number; quantidade: number };
export type PontoRTatStatus = { periodo: string; status: string; tat_medio_dias: number; quantidade: number };
export type ContagemStatus = { status_operacional: string; quantidade: number };

/** Formata dias fracionários pro padrão de exibição do sistema (1 casa
 * decimal) — TAT quase nunca é um número redondo de dias, já que
 * Data Reconhecimento não tem hora (meia-noite) mas as mudanças de
 * status têm hora certa. */
export function formatarDias(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}d`;
}

// ---- Métricas > Orçamentos (resultado: aprovado/reprovado/contra
// proposta) — ver migration 0029_metricas_orcamentos.sql ----

/** Janela padrão (terminando hoje, Brasília) pra telas de métricas que
 * não têm granularidade (dia/semana/mês), só um período — diferente de
 * intervaloPadrao(g), que é pensado pros gráficos de série temporal. */
export function intervaloPadraoDias(dias: number): { inicio: string; fim: string } {
  const fim = hojeBrasiliaIso();
  return { inicio: somarDias(fim, -dias), fim };
}

export type ResultadoOrcamento =
  | "aprovado_primeira"
  | "reprovado_primeira"
  | "contra_proposta_aceita"
  | "contra_proposta_recusada";

export const RESULTADOS_ORCAMENTO: { valor: ResultadoOrcamento; label: string; cor: string }[] = [
  { valor: "aprovado_primeira", label: "Aprovado de primeira", cor: "#22c55e" },
  { valor: "reprovado_primeira", label: "Reprovado de primeira", cor: "#ef4444" },
  { valor: "contra_proposta_aceita", label: "Contra proposta aceita", cor: "#0ea5e9" },
  { valor: "contra_proposta_recusada", label: "Contra proposta recusada", cor: "#f97316" },
];

export function labelResultado(valor: string): string {
  return RESULTADOS_ORCAMENTO.find((r) => r.valor === valor)?.label ?? valor;
}

export function corResultado(valor: string): string {
  return RESULTADOS_ORCAMENTO.find((r) => r.valor === valor)?.cor ?? "var(--muted)";
}

/** Um orçamento "aprovado" (de primeira ou por contra proposta aceita) —
 * usado pra somar as duas categorias positivas em vários lugares da tela
 * (% de aprovação geral, por lote, por modelo, por peça). */
export function resultadoEhAprovado(valor: string): boolean {
  return valor === "aprovado_primeira" || valor === "contra_proposta_aceita";
}

/** Uma linha por orçamento fechado, exatamente como volta de
 * metricas_resultado_orcamentos — venda_total_pecas/mao_de_obra/
 * valor_total_reparo vêm null quando o orçamento foi reprovado antes de
 * passar por Validação de Orçamentos (nunca teve preço apurado). */
export type LinhaResultadoOrcamento = {
  orcamento_id: string;
  nf_remessa_allied: string | null;
  modelo_comercial: string | null;
  resultado: ResultadoOrcamento;
  fechado_em: string;
  venda_total_pecas: number | null;
  mao_de_obra: number | null;
  valor_total_reparo: number | null;
};

/** Uma linha por Part Number x resultado, exatamente como volta de
 * metricas_resultado_pecas (já agregado por quantidade no banco). */
export type LinhaResultadoPeca = {
  part_number: string;
  resultado: ResultadoOrcamento;
  quantidade: number;
};

export type ResumoResultados = {
  total: number;
  porResultado: Record<ResultadoOrcamento, number>;
  percentualPorResultado: Record<ResultadoOrcamento, number>;
  percentualAprovacaoGeral: number;
  valorMedioPorResultado: Record<ResultadoOrcamento, number | null>;
};

/** Resumo geral do período: quantidade e % de cada uma das 4 categorias,
 * a % de aprovação combinada (aprovado de primeira + contra proposta
 * aceita) e o valor médio (Venda de Peça + Mão de obra) de cada
 * categoria — ignora as linhas sem valor apurado (reprovado antes de
 * Validação de Orçamentos) em vez de contar como zero, senão a média cai
 * artificialmente. */
export function resumirResultados(linhas: LinhaResultadoOrcamento[]): ResumoResultados {
  const total = linhas.length;
  const porResultado = {} as Record<ResultadoOrcamento, number>;
  const somaValorPorResultado = {} as Record<ResultadoOrcamento, number>;
  const contagemComValorPorResultado = {} as Record<ResultadoOrcamento, number>;

  for (const r of RESULTADOS_ORCAMENTO) {
    porResultado[r.valor] = 0;
    somaValorPorResultado[r.valor] = 0;
    contagemComValorPorResultado[r.valor] = 0;
  }

  for (const linha of linhas) {
    porResultado[linha.resultado] += 1;
    if (linha.valor_total_reparo != null) {
      somaValorPorResultado[linha.resultado] += linha.valor_total_reparo;
      contagemComValorPorResultado[linha.resultado] += 1;
    }
  }

  const percentualPorResultado = {} as Record<ResultadoOrcamento, number>;
  const valorMedioPorResultado = {} as Record<ResultadoOrcamento, number | null>;
  for (const r of RESULTADOS_ORCAMENTO) {
    percentualPorResultado[r.valor] = total > 0 ? (porResultado[r.valor] / total) * 100 : 0;
    valorMedioPorResultado[r.valor] =
      contagemComValorPorResultado[r.valor] > 0 ? somaValorPorResultado[r.valor] / contagemComValorPorResultado[r.valor] : null;
  }

  const aprovados = porResultado.aprovado_primeira + porResultado.contra_proposta_aceita;
  const percentualAprovacaoGeral = total > 0 ? (aprovados / total) * 100 : 0;

  return { total, porResultado, percentualPorResultado, percentualAprovacaoGeral, valorMedioPorResultado };
}

export type LinhaResultadoPorLote = {
  nfRemessaAllied: string;
  total: number;
  porResultado: Record<ResultadoOrcamento, number>;
  percentualAprovacao: number;
};

/** Agrupa por NF Remessa (lote) — quantidade de cada resultado e o % de
 * aprovação combinado daquele lote específico, ordenado do lote com mais
 * orçamentos fechados pro com menos. */
export function agruparResultadoPorLote(linhas: LinhaResultadoOrcamento[]): LinhaResultadoPorLote[] {
  const porLote = new Map<string, LinhaResultadoOrcamento[]>();
  for (const linha of linhas) {
    const chave = linha.nf_remessa_allied ?? "(sem NF Remessa)";
    if (!porLote.has(chave)) porLote.set(chave, []);
    porLote.get(chave)!.push(linha);
  }

  return Array.from(porLote.entries())
    .map(([nfRemessaAllied, doLote]) => {
      const resumo = resumirResultados(doLote);
      return {
        nfRemessaAllied,
        total: resumo.total,
        porResultado: resumo.porResultado,
        percentualAprovacao: resumo.percentualAprovacaoGeral,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type LinhaResultadoPorModelo = {
  modeloComercial: string;
  total: number;
  porResultado: Record<ResultadoOrcamento, number>;
  percentualAprovacao: number;
};

/** Agrupa por Modelo Comercial — mesma ideia do agrupamento por lote,
 * pra achar quais modelos concentram mais reprovação (ou mais aprovação,
 * pra comparar). Ordenado do modelo com mais orçamentos fechados pro com
 * menos — a tela decide o corte (top N) e a ordenação por reprovação. */
export function agruparResultadoPorModelo(linhas: LinhaResultadoOrcamento[]): LinhaResultadoPorModelo[] {
  const porModelo = new Map<string, LinhaResultadoOrcamento[]>();
  for (const linha of linhas) {
    const chave = linha.modelo_comercial ?? "(sem modelo)";
    if (!porModelo.has(chave)) porModelo.set(chave, []);
    porModelo.get(chave)!.push(linha);
  }

  return Array.from(porModelo.entries())
    .map(([modeloComercial, doModelo]) => {
      const resumo = resumirResultados(doModelo);
      return {
        modeloComercial,
        total: resumo.total,
        porResultado: resumo.porResultado,
        percentualAprovacao: resumo.percentualAprovacaoGeral,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type RankingPeca = {
  partNumber: string;
  total: number;
  porResultado: Record<ResultadoOrcamento, number>;
  percentualReprovacao: number;
};

/** Ranking de Part Number, considerando TODAS as peças de todo aparelho
 * do período (não só a peça 1) — percentualReprovacao = (reprovado de
 * primeira + contra proposta recusada) / total de ocorrências desse
 * Part Number, pra achar peças que puxam reprovação mesmo aparecendo em
 * modelos diferentes. */
export function agruparRankingPecas(linhas: LinhaResultadoPeca[]): RankingPeca[] {
  const porPeca = new Map<string, LinhaResultadoPeca[]>();
  for (const linha of linhas) {
    if (!porPeca.has(linha.part_number)) porPeca.set(linha.part_number, []);
    porPeca.get(linha.part_number)!.push(linha);
  }

  return Array.from(porPeca.entries())
    .map(([partNumber, doPeca]) => {
      const porResultado = {} as Record<ResultadoOrcamento, number>;
      for (const r of RESULTADOS_ORCAMENTO) porResultado[r.valor] = 0;
      let total = 0;
      for (const linha of doPeca) {
        porResultado[linha.resultado] += linha.quantidade;
        total += linha.quantidade;
      }
      const reprovados = porResultado.reprovado_primeira + porResultado.contra_proposta_recusada;
      const percentualReprovacao = total > 0 ? (reprovados / total) * 100 : 0;
      return { partNumber, total, porResultado, percentualReprovacao };
    })
    .sort((a, b) => b.total - a.total);
}

export function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
