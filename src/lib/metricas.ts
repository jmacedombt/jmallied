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
