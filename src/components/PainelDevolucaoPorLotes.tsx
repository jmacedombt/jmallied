"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Clock, Search, Target, Timer, X } from "lucide-react";

// Métricas > Devolução por Lotes (migrations 0084/0086). Faixas de dias
// corridos da Data Reconhecimento até o aparelho ser REALIZADO: Produto
// Entregue ou Orçamento Reprovado (reprovado conta como realizado — a
// avaliação foi feita). Meta = até 7 dias.

export type LoteDevolucao = {
  nf: string;
  dataReconhecimento: string;
  /** todos os aparelhos do lote (base dos percentuais) */
  recebidos: number;
  /** realizados = Produto Entregue + Orçamento Reprovado */
  entregues: number;
  /** até 7, 8–14, 15–21, 22–28, acima de 28 */
  faixas: number[];
  emAberto: number;
  abertoAtrasado: number;
  abertoMaxDias: number | null;
  /** quantos dos realizados vieram de reprovação */
  reprovados: number;
  somaDias: number;
  diasEntregues: number[];
  ultimaEntrega: string | null;
};

const META_DIAS = 7;
const FAIXAS = ["Até 7 dias", "8 a 14 dias", "15 a 21 dias", "22 a 28 dias", "Acima de 28"];
// cores da barra de distribuição (verde = meta → vermelho)
const CORES_FAIXA = ["#16a34a", "#84cc16", "#eab308", "#f97316", "#dc2626"];

type SituacaoMeta = "batida" | "andamento" | "fora";

function situacaoDe(l: LoteDevolucao): SituacaoMeta {
  const entreguesForaDoPrazo = l.entregues - l.faixas[0];
  if (entreguesForaDoPrazo > 0 || l.abertoAtrasado > 0) return "fora";
  if (l.emAberto > 0) return "andamento";
  return "batida";
}

const ROTULO_SITUACAO: Record<SituacaoMeta, { texto: string; cor: string; fundo: string }> = {
  batida: { texto: "Meta batida", cor: "#15803d", fundo: "rgba(22, 163, 74, 0.14)" },
  andamento: { texto: "No prazo", cor: "#0369a1", fundo: "rgba(14, 165, 233, 0.14)" },
  fora: { texto: "Fora da meta", cor: "#b91c1c", fundo: "rgba(220, 38, 38, 0.14)" },
};

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

function formatarPct(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarDias(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} d`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function corMeta(p: number): string {
  if (p >= 90) return "#16a34a";
  if (p >= 70) return "#d97706";
  return "#dc2626";
}

function Cartao({
  icone: Icone,
  titulo,
  cor,
  children,
}: {
  icone: typeof Target;
  titulo: string;
  cor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-xl border p-4 overflow-hidden"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: cor }} />
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
        <Icone size={13} style={{ color: cor }} />
        {titulo}
      </p>
      {children}
    </div>
  );
}

type Filtro = "todos" | SituacaoMeta;

export default function PainelDevolucaoPorLotes({ lotes }: { lotes: LoteDevolucao[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionado, setSelecionado] = useState<LoteDevolucao | null>(null);

  const resumo = useMemo(() => {
    const recebidos = lotes.reduce((s, l) => s + l.recebidos, 0);
    const entregues = lotes.reduce((s, l) => s + l.entregues, 0);
    const emAberto = lotes.reduce((s, l) => s + l.emAberto, 0);
    const reprovados = lotes.reduce((s, l) => s + l.reprovados, 0);
    const faixas = FAIXAS.map((_, i) => lotes.reduce((s, l) => s + l.faixas[i], 0));
    const somaDias = lotes.reduce((s, l) => s + l.somaDias, 0);
    const todosDias = lotes.flatMap((l) => l.diasEntregues);
    const atrasados = lotes.reduce((s, l) => s + l.abertoAtrasado, 0);
    const lotesComAtraso = lotes.filter((l) => l.abertoAtrasado > 0);
    const maisAntigo = lotes
      .filter((l) => l.emAberto > 0 && l.abertoMaxDias != null)
      .sort((a, b) => (b.abertoMaxDias ?? 0) - (a.abertoMaxDias ?? 0))[0];
    const situacoes = lotes.map(situacaoDe);
    const piorLote = lotes
      .filter((l) => l.entregues > 0)
      .map((l) => ({ nf: l.nf, media: l.somaDias / l.entregues }))
      .sort((a, b) => b.media - a.media)[0];
    return {
      recebidos,
      entregues,
      emAberto,
      reprovados,
      faixas,
      media: entregues > 0 ? somaDias / entregues : null,
      mediana: mediana(todosDias),
      percMeta: pct(faixas[0], entregues),
      atrasados,
      lotesComAtraso,
      maisAntigo,
      batidas: situacoes.filter((s) => s === "batida").length,
      andamento: situacoes.filter((s) => s === "andamento").length,
      fora: situacoes.filter((s) => s === "fora").length,
      piorLote,
    };
  }, [lotes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lotes.filter(
      (l) => (!termo || l.nf.toLowerCase().includes(termo)) && (filtro === "todos" || situacaoDe(l) === filtro)
    );
  }, [lotes, busca, filtro]);

  if (lotes.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Nenhum lote reconhecido nesse período.
      </p>
    );
  }

  const totalFiltrado = {
    recebidos: filtrados.reduce((s, l) => s + l.recebidos, 0),
    entregues: filtrados.reduce((s, l) => s + l.entregues, 0),
    faixas: FAIXAS.map((_, i) => filtrados.reduce((s, l) => s + l.faixas[i], 0)),
    emAberto: filtrados.reduce((s, l) => s + l.emAberto, 0),
    atrasado: filtrados.reduce((s, l) => s + l.abertoAtrasado, 0),
    somaDias: filtrados.reduce((s, l) => s + l.somaDias, 0),
  };

  const th = "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="space-y-5">
      {/* ---------- cards ---------- */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Cartao icone={Target} titulo={`Meta — entregue em até ${META_DIAS} dias`} cor={corMeta(resumo.percMeta)}>
          <p className="text-3xl font-bold" style={{ color: corMeta(resumo.percMeta) }}>
            {resumo.entregues > 0 ? formatarPct(resumo.percMeta) : "—"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {resumo.faixas[0]} de {resumo.entregues} realizados dentro da meta
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
            {(["batida", "andamento", "fora"] as SituacaoMeta[]).map((s) => (
              <span
                key={s}
                className="rounded-md px-1.5 py-0.5 font-semibold"
                style={{ color: ROTULO_SITUACAO[s].cor, background: ROTULO_SITUACAO[s].fundo }}
              >
                {resumo[s === "batida" ? "batidas" : s]} {ROTULO_SITUACAO[s].texto.toLowerCase()}
              </span>
            ))}
          </div>
        </Cartao>

        <Cartao icone={Boxes} titulo="Volumes" cor="#2563eb">
          <p className="text-3xl font-bold" style={{ color: "var(--ink)" }}>
            {lotes.length} <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>lotes</span>
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
            <div>
              <p style={{ color: "var(--muted)" }}>Recebidos</p>
              <p className="font-bold text-sm" style={{ color: "var(--ink)" }}>{resumo.recebidos}</p>
            </div>
            <div>
              <p style={{ color: "var(--muted)" }}>Realizados</p>
              <p className="font-bold text-sm" style={{ color: "#16a34a" }}>
                {resumo.entregues}{" "}
                <span className="font-normal" style={{ color: "var(--muted)" }}>
                  ({formatarPct(pct(resumo.entregues, resumo.recebidos))})
                </span>
              </p>
            </div>
            <div>
              <p style={{ color: "var(--muted)" }}>Em aberto</p>
              <p className="font-bold text-sm" style={{ color: "#0369a1" }}>{resumo.emAberto}</p>
            </div>
          </div>
          {resumo.reprovados > 0 && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
              dos realizados, {resumo.reprovados} foram orçamento reprovado
            </p>
          )}
        </Cartao>

        <Cartao icone={Timer} titulo="Tempo até realizar" cor="#7c3aed">
          <p className="text-3xl font-bold" style={{ color: "var(--ink)" }}>
            {formatarDias(resumo.media)}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            média · mediana <strong style={{ color: "var(--ink)" }}>{formatarDias(resumo.mediana)}</strong>
          </p>
          {resumo.piorLote && (
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Pior lote: <strong style={{ color: "#dc2626" }}>{resumo.piorLote.nf}</strong> (
              {formatarDias(resumo.piorLote.media)} em média)
            </p>
          )}
        </Cartao>

        <Cartao icone={AlertTriangle} titulo={`Em aberto há mais de ${META_DIAS} dias`} cor="#dc2626">
          <p className="text-3xl font-bold" style={{ color: resumo.atrasados > 0 ? "#dc2626" : "#16a34a" }}>
            {resumo.atrasados}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {resumo.atrasados > 0
              ? `aparelho(s) já fora da meta em ${resumo.lotesComAtraso.length} lote(s)`
              : "nenhum aparelho em aberto fora da meta"}
          </p>
          {resumo.maisAntigo && (
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              Mais antigo: <strong style={{ color: "var(--ink)" }}>{resumo.maisAntigo.nf}</strong> há{" "}
              {resumo.maisAntigo.abertoMaxDias} dias
            </p>
          )}
          {resumo.lotesComAtraso.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltro("fora")}
              className="text-[11px] mt-1.5 underline decoration-dotted"
              style={{ color: "#b91c1c" }}
            >
              Ver lotes fora da meta
            </button>
          )}
        </Cartao>
      </div>

      {/* ---------- distribuição geral ---------- */}
      {resumo.entregues > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Distribuição dos realizados no período (entregues + reprovados)
          </p>
          <div className="flex h-6 w-full overflow-hidden rounded-md">
            {resumo.faixas.map((q, i) =>
              q > 0 ? (
                <div
                  key={i}
                  title={`${FAIXAS[i]}: ${q} (${formatarPct(pct(q, resumo.entregues))})`}
                  className="flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ width: `${pct(q, resumo.entregues)}%`, background: CORES_FAIXA[i] }}
                >
                  {pct(q, resumo.entregues) >= 6 ? formatarPct(pct(q, resumo.entregues)) : ""}
                </div>
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {FAIXAS.map((f, i) => (
              <span key={f} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CORES_FAIXA[i] }} />
                {f}: <strong style={{ color: "var(--ink)" }}>{resumo.faixas[i]}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------- filtros da tabela ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar NF Remessa"
            className="rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
          />
        </div>
        {(
          [
            ["todos", `Todos (${lotes.length})`],
            ["fora", `Fora da meta (${resumo.fora})`],
            ["andamento", `No prazo (${resumo.andamento})`],
            ["batida", `Meta batida (${resumo.batidas})`],
          ] as [Filtro, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
            style={
              filtro === valor
                ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                : { borderColor: "var(--line)", color: "var(--muted)", background: "var(--surface)" }
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* ---------- tabela: uma linha por lote, clique abre o resumo ---------- */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface2)", color: "var(--muted)" }}>
            <tr>
              <th className={`${th} text-left`}>Lote (NF Remessa)</th>
              <th className={`${th} text-left`}>Reconhecido</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`} title="Produto Entregue + Orçamento Reprovado">Realizados</th>
              {FAIXAS.map((f, i) => (
                <th key={f} className={`${th} text-center`} style={i === 0 ? { color: "#15803d" } : undefined}>
                  {f}
                  {i === 0 && " (meta)"}
                </th>
              ))}
              <th className={`${th} text-center`}>Em aberto</th>
              <th className={`${th} text-right`}>Média</th>
              <th className={`${th} text-center`}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => {
              const sit = ROTULO_SITUACAO[situacaoDe(l)];
              return (
                <tr
                  key={l.nf}
                  onClick={() => setSelecionado(l)}
                  title="Clique para ver o resumo do lote"
                  className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <td className="px-3 py-1.5 font-mono text-[15px] font-bold whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nf}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatarData(l.dataReconhecimento)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {l.recebidos}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: "var(--ink)" }}>
                    {l.entregues}
                  </td>
                  {l.faixas.map((q, i) => (
                    <td key={i} className="px-2 py-1.5 text-center whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      <CelulaQtd q={q} total={l.recebidos} destaque={i === 0 ? "#15803d" : undefined} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    <CelulaQtd q={l.emAberto} total={l.recebidos} />
                    {l.abertoAtrasado > 0 && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold"
                        style={{ color: "#dc2626" }}
                        title={`${l.abertoAtrasado} em aberto há mais de ${META_DIAS} dias (mais antigo: ${l.abertoMaxDias} dias)`}
                      >
                        <Clock size={10} />
                        {l.abertoAtrasado}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.entregues > 0 ? formatarDias(l.somaDias / l.entregues) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: sit.cor, background: sit.fundo }}
                    >
                      {situacaoDe(l) === "batida" && <CheckCircle2 size={10} />}
                      {sit.texto}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>
                  Nenhum lote nesse filtro.
                </td>
              </tr>
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot style={{ background: "var(--surface2)" }}>
              <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                <td className="px-3 py-2 text-xs" colSpan={2}>
                  Total ({filtrados.length} lotes)
                </td>
                <td className="px-3 py-2 text-right">{totalFiltrado.recebidos}</td>
                <td className="px-3 py-2 text-right">{totalFiltrado.entregues}</td>
                {totalFiltrado.faixas.map((q, i) => (
                  <td key={i} className="px-2 py-2 text-center whitespace-nowrap">
                    <CelulaQtd q={q} total={totalFiltrado.recebidos} mostrarZero />
                  </td>
                ))}
                <td className="px-2 py-2 text-center whitespace-nowrap">
                  <CelulaQtd q={totalFiltrado.emAberto} total={totalFiltrado.recebidos} mostrarZero />
                  {totalFiltrado.atrasado > 0 && (
                    <span className="ml-1.5 text-[11px] font-bold" style={{ color: "#dc2626" }}>
                      {totalFiltrado.atrasado} &gt;{META_DIAS}d
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  {totalFiltrado.entregues > 0 ? formatarDias(totalFiltrado.somaDias / totalFiltrado.entregues) : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Realizados = Produto Entregue + Orçamento Reprovado (a avaliação foi feita). Percentuais sobre o total do lote.
        Dias corridos da Data Reconhecimento até a entrega ou a reprovação. Clique num lote para ver o resumo.
      </p>

      {selecionado && <ResumoLote lote={selecionado} onFechar={() => setSelecionado(null)} />}
    </div>
  );
}

function CelulaQtd({
  q,
  total,
  destaque,
  mostrarZero = false,
}: {
  q: number;
  total: number;
  destaque?: string;
  mostrarZero?: boolean;
}) {
  if (q <= 0 && !mostrarZero) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <span>
      <strong style={destaque ? { color: destaque } : undefined}>{q}</strong>
      <span className="ml-1 text-[11px]" style={{ color: "var(--muted)" }}>
        ({formatarPct(pct(q, total))})
      </span>
    </span>
  );
}

function ResumoLote({ lote, onFechar }: { lote: LoteDevolucao; onFechar: () => void }) {
  const sit = ROTULO_SITUACAO[situacaoDe(lote)];
  const linhas: { rotulo: string; q: number; cor: string }[] = [
    ...FAIXAS.map((f, i) => ({ rotulo: i === 0 ? `${f} (meta)` : f, q: lote.faixas[i], cor: CORES_FAIXA[i] })),
    { rotulo: "Em aberto", q: lote.emAberto, cor: "#0369a1" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Lote (NF Remessa)
            </p>
            <p className="font-mono text-2xl font-bold" style={{ color: "var(--ink)" }}>
              {lote.nf}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Reconhecido em {formatarData(lote.dataReconhecimento)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>Total do lote</p>
            <p className="text-xl font-bold" style={{ color: "var(--ink)" }}>{lote.recebidos}</p>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>Realizados</p>
            <p className="text-xl font-bold" style={{ color: "#16a34a" }}>{lote.entregues}</p>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>Média</p>
            <p className="text-xl font-bold" style={{ color: "var(--ink)" }}>
              {lote.entregues > 0 ? formatarDias(lote.somaDias / lote.entregues) : "—"}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              <th className="text-left text-[11px] uppercase tracking-wide pb-1.5">Prazo</th>
              <th className="text-right text-[11px] uppercase tracking-wide pb-1.5">Qtd</th>
              <th className="text-right text-[11px] uppercase tracking-wide pb-1.5">%</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-1.5" style={{ color: "var(--ink)" }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: l.cor }} />
                  {l.rotulo}
                </td>
                <td className="py-1.5 text-right font-semibold" style={{ color: "var(--ink)" }}>{l.q}</td>
                <td className="py-1.5 text-right" style={{ color: "var(--ink)" }}>{formatarPct(pct(l.q, lote.recebidos))}</td>
              </tr>
            ))}
            <tr className="border-t font-bold" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">{lote.recebidos}</td>
              <td className="py-1.5 text-right">100,0%</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 space-y-1.5 text-xs">
          <p>
            Situação:{" "}
            <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ color: sit.cor, background: sit.fundo }}>
              {sit.texto}
            </span>
          </p>
          {lote.reprovados > 0 && (
            <p style={{ color: "var(--muted)" }}>
              Dos realizados, {lote.reprovados} foram orçamento reprovado (contam como realizados).
            </p>
          )}
          {lote.abertoAtrasado > 0 && (
            <p style={{ color: "#dc2626" }}>
              {lote.abertoAtrasado} em aberto há mais de {META_DIAS} dias — o mais antigo há {lote.abertoMaxDias} dias.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
