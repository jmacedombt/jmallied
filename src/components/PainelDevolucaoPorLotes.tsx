"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, Clock, Search, Target, Timer } from "lucide-react";

// Métricas > Devolução por Lotes (migration 0084). Faixas de dias corridos
// da Data Reconhecimento até "Produto Entregue". Meta = até 7 dias.

export type LoteDevolucao = {
  nf: string;
  dataReconhecimento: string;
  /** aparelhos do lote, sem os reprovados (base dos percentuais) */
  recebidos: number;
  entregues: number;
  /** até 7, 8–14, 15–21, 22–28, acima de 28 */
  faixas: number[];
  emAberto: number;
  abertoAtrasado: number;
  abertoMaxDias: number | null;
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

// mapa de calor: mais escuro = maior percentual da tabela
function estiloCalor(p: number, max: number): React.CSSProperties {
  if (p <= 0 || max <= 0) return {};
  const t = Math.min(1, p / max);
  return {
    background: `rgba(8, 145, 178, ${(0.08 + 0.82 * t).toFixed(3)})`,
    color: t > 0.55 ? "#fff" : "var(--ink)",
  };
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

  // maior percentual da tabela (faixas + em aberto) — referência do degradê
  const maxPct = useMemo(() => {
    let m = 0;
    for (const l of filtrados) {
      for (const q of [...l.faixas, l.emAberto]) m = Math.max(m, pct(q, l.recebidos));
    }
    return m;
  }, [filtrados]);

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
            {resumo.faixas[0]} de {resumo.entregues} entregues dentro da meta
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
              <p style={{ color: "var(--muted)" }}>Entregues</p>
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
              + {resumo.reprovados} reprovado(s) fora da conta
            </p>
          )}
        </Cartao>

        <Cartao icone={Timer} titulo="Tempo até a entrega" cor="#7c3aed">
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
            Distribuição das entregas no período
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

      {/* ---------- tabela (mapa de calor) ---------- */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--surface2)", color: "var(--muted)" }}>
            <tr>
              <th className={`${th} text-left`}>Lote (NF Remessa)</th>
              <th className={`${th} text-left`}>Reconhecido</th>
              <th className={`${th} text-right`}>Recebidos</th>
              <th className={`${th} text-right`}>Entregues</th>
              {FAIXAS.map((f, i) => (
                <th
                  key={f}
                  className={`${th} text-center`}
                  style={i === 0 ? { color: "#15803d", background: "rgba(22, 163, 74, 0.1)" } : undefined}
                >
                  {f}
                  {i === 0 && <span className="block text-[9px] normal-case">meta</span>}
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
                <tr key={l.nf} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nf}
                    {l.reprovados > 0 && (
                      <span className="ml-1.5 text-[10px]" style={{ color: "var(--muted)" }} title="Reprovados (fora da conta)">
                        +{l.reprovados} reprov.
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatarData(l.dataReconhecimento)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {l.recebidos}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                    {l.entregues}
                  </td>
                  {l.faixas.map((q, i) => {
                    const p = pct(q, l.recebidos);
                    return (
                      <td key={i} className="px-2 py-2 text-center whitespace-nowrap" style={estiloCalor(p, maxPct)}>
                        {q > 0 ? (
                          <>
                            <span className="font-bold">{q}</span>
                            <span className="block text-[10px] opacity-90">{formatarPct(p)}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className="px-2 py-2 text-center whitespace-nowrap"
                    style={estiloCalor(pct(l.emAberto, l.recebidos), maxPct)}
                  >
                    {l.emAberto > 0 ? (
                      <>
                        <span className="font-bold">{l.emAberto}</span>
                        <span className="block text-[10px] opacity-90">{formatarPct(pct(l.emAberto, l.recebidos))}</span>
                        {l.abertoAtrasado > 0 && (
                          <span
                            className="mt-0.5 inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-bold"
                            style={{ background: "#dc2626", color: "#fff" }}
                            title={`${l.abertoAtrasado} em aberto há mais de ${META_DIAS} dias (mais antigo: ${l.abertoMaxDias} dias)`}
                          >
                            <Clock size={9} />
                            {l.abertoAtrasado} &gt;{META_DIAS}d
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.entregues > 0 ? formatarDias(l.somaDias / l.entregues) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
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
                <td className="px-3 py-2.5 text-xs" colSpan={2}>
                  Total ({filtrados.length} lotes)
                </td>
                <td className="px-3 py-2.5 text-right">{totalFiltrado.recebidos}</td>
                <td className="px-3 py-2.5 text-right">{totalFiltrado.entregues}</td>
                {totalFiltrado.faixas.map((q, i) => (
                  <td key={i} className="px-2 py-2.5 text-center whitespace-nowrap">
                    {q}
                    <span className="block text-[10px] font-normal" style={{ color: "var(--muted)" }}>
                      {formatarPct(pct(q, totalFiltrado.recebidos))}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center whitespace-nowrap">
                  {totalFiltrado.emAberto}
                  <span className="block text-[10px] font-normal" style={{ color: "var(--muted)" }}>
                    {formatarPct(pct(totalFiltrado.emAberto, totalFiltrado.recebidos))}
                    {totalFiltrado.atrasado > 0 && ` · ${totalFiltrado.atrasado} >${META_DIAS}d`}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs">
                  {totalFiltrado.entregues > 0 ? formatarDias(totalFiltrado.somaDias / totalFiltrado.entregues) : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Percentuais sobre os aparelhos recebidos do lote (sem os reprovados). Quanto mais escura a célula, maior o
        percentual. Dias corridos da Data Reconhecimento até a entrada em Produto Entregue.
      </p>
    </div>
  );
}
