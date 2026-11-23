"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, Search, X } from "lucide-react";
import { STATUS_OPERACIONAL, GRUPO_STATUS_AG_EMISSAO_NF } from "@/lib/orcamentos";
import { formatarDias, hojeBrasiliaIso } from "@/lib/metricas";

export type LinhaBacklogResumo = {
  nfRemessa: string;
  totalLote: number;
  quantidadePendente: number;
  quantidadeEntregue: number;
  quantidadeReprovada: number;
  mediaRtatPendenteDias: number | null;
};

// mesma identidade de cor de cada etapa usada no Painel Operacional (ver
// CORES em operacional/page.tsx) — só pra diferenciar visualmente as
// linhas do pop-up de detalhe, sem outro significado.
const CORES_STATUS: Record<string, string> = {
  "ag-abertura": "#64748b",
  "1-ag-triagem": "#2563eb",
  "2-ag-analise": "#7c3aed",
  "validacao-orcamentos": "#14b8a6",
  "3-ag-resposta-orcamento": "#d97706",
  "ag-contra-proposta": "#ca8a04",
  "4-ag-resposta-reorcamento": "#ea580c",
  "5-ag-pecas": "#0891b2",
  "6-ag-reparo": "#9333ea",
  "oqc-controle-qualidade": "#4f46e5",
  "7-reparo-finalizado": "#059669",
  "8-orcamento-reprovado": "#dc2626",
  "ag-emissao-nf": "#0ea5e9",
  "produto-entregue": "#0d9488",
};

type AparelhoPendente = {
  id: string;
  trade_allied: string;
  os_reparadora: string | null;
  os_care_allied: string | null;
  imei_allied: string | null;
  modelo_comercial: string | null;
  status_operacional: string;
  data_reconhecimento: string | null;
};

function corDoStatus(valor: string): string {
  const s = STATUS_OPERACIONAL.find((x) => x.valor === valor);
  if (s) return CORES_STATUS[s.slug] ?? "#64748b";
  if ((GRUPO_STATUS_AG_EMISSAO_NF as readonly string[]).includes(valor)) return CORES_STATUS["ag-emissao-nf"];
  return "#64748b";
}

function diasDesde(iso: string | null, hoje: string): number | null {
  if (!iso) return null;
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hoje}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86400000));
}

function quantidadeDoStatusNoLote(porStatus: Record<string, number>, status: (typeof STATUS_OPERACIONAL)[number]): number {
  if (status.slug === "ag-emissao-nf") {
    return GRUPO_STATUS_AG_EMISSAO_NF.reduce((soma, v) => soma + (porStatus[v] ?? 0), 0);
  }
  return porStatus[status.valor] ?? 0;
}

/**
 * Tabela principal do Backlog (pedido explícito, substitui a matriz de
 * colunas numeradas da versão anterior): uma linha por lote (NF Remessa)
 * ainda com algo pendente — total do lote (todos os orçamentos já
 * importados com essa NF, qualquer status), quantidade pendente (antes
 * de virar Produto Entregue) e o R-TAT médio de quem está pendente.
 *
 * Clicar numa linha abre um pop-up com a quantidade em CADA status/card
 * (todos, não só os numerados) daquele lote — a visualização mostra
 * tudo; só a exportação em Excel (botão "Exportar backlog", inalterado)
 * continua seguindo a regra vigente de só considerar os status com
 * numeração.
 */
export default function PainelBacklogPorLote({
  linhas,
  detalhePorLote,
  mensagemVazia = "Nenhum lote com pendência no momento.",
}: {
  linhas: LinhaBacklogResumo[];
  /** nf_remessa_allied -> { status_operacional: quantidade } — TODOS os
   * status, usado só pelo pop-up de detalhe (ver migration 0053). */
  detalhePorLote: Record<string, Record<string, number>>;
  mensagemVazia?: string;
}) {
  const [loteAberto, setLoteAberto] = useState<string | null>(null);

  const porStatusDoLoteAberto = loteAberto ? (detalhePorLote[loteAberto] ?? {}) : {};
  const totalDoLoteAberto = linhas.find((l) => l.nfRemessa === loteAberto)?.totalLote ?? 0;

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Lote (NF Remessa)</th>
              <th className="px-4 py-2.5 font-medium text-right">Total do lote</th>
              <th className="px-4 py-2.5 font-medium text-right">Pendente</th>
              <th className="px-4 py-2.5 font-medium text-right">R-TAT médio</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.nfRemessa}
                onClick={() => setLoteAberto(l.nfRemessa)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver as pendências desse lote"
              >
                <td className="px-4 py-2.5 font-semibold">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLoteAberto(l.nfRemessa);
                    }}
                    className="underline decoration-dotted underline-offset-4 hover:opacity-80"
                    style={{ color: "var(--accent2)" }}
                    title="Ver as pendências desse lote"
                  >
                    {l.nfRemessa}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {l.totalLote}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLoteAberto(l.nfRemessa);
                    }}
                    className="underline decoration-dotted underline-offset-4 hover:opacity-80"
                    style={{ color: "var(--accent2)" }}
                    title="Ver as pendências desse lote"
                  >
                    {l.quantidadePendente}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {l.mediaRtatPendenteDias != null ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Gauge size={12} style={{ color: "var(--accent2)" }} />
                      {formatarDias(l.mediaRtatPendenteDias)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loteAberto && (
        <PopupPendenciasLote
          nf={loteAberto}
          totalLote={totalDoLoteAberto}
          porStatus={porStatusDoLoteAberto}
          onFechar={() => setLoteAberto(null)}
        />
      )}
    </>
  );
}

/**
 * Pop-up de pendências do lote (pedido explícito, 23/11/2026): resumo por
 * status no topo (só os que têm pendência) e a lista dos aparelhos
 * pendentes, com busca. Largura grande e rolagem só dentro da lista, pra
 * nada ficar cortado em telas menores (tabela rola na horizontal se
 * precisar, cabeçalho fixo).
 */
function PopupPendenciasLote({
  nf,
  totalLote,
  porStatus,
  onFechar,
}: {
  nf: string;
  totalLote: number;
  porStatus: Record<string, number>;
  onFechar: () => void;
}) {
  const [aparelhos, setAparelhos] = useState<AparelhoPendente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null);
  const hoje = hojeBrasiliaIso();

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/operacional/backlog/lote?nf=${encodeURIComponent(nf)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (cancelado) return;
        if (!r.ok) throw new Error(d?.error || "Não foi possível carregar as pendências.");
        setAparelhos(d.aparelhos ?? []);
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha de conexão."));
    return () => {
      cancelado = true;
    };
  }, [nf]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  // resumo por status, só os pendentes (sem Produto Entregue)
  const resumo = STATUS_OPERACIONAL.filter((st) => st.slug !== "produto-entregue")
    .map((st) => ({ status: st, quantidade: quantidadeDoStatusNoLote(porStatus, st) }))
    .filter((r) => r.quantidade > 0);
  const totalPendente = resumo.reduce((s, r) => s + r.quantidade, 0);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (aparelhos ?? []).filter((a) => {
      if (statusFiltro) {
        const st = STATUS_OPERACIONAL.find((x) => x.slug === statusFiltro);
        const valores =
          statusFiltro === "ag-emissao-nf" ? (GRUPO_STATUS_AG_EMISSAO_NF as readonly string[]) : st ? [st.valor] : [];
        if (!valores.includes(a.status_operacional)) return false;
      }
      if (!termo) return true;
      return [a.trade_allied, a.os_reparadora, a.os_care_allied, a.imei_allied, a.modelo_comercial]
        .some((v) => (v ?? "").toLowerCase().includes(termo));
    });
  }, [aparelhos, busca, statusFiltro]);

  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-6xl h-[calc(100vh-1rem)] sm:h-auto sm:max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabeçalho fixo */}
        <div className="shrink-0 px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                Lote <span className="font-mono" style={{ color: "var(--accent2)" }}>{nf}</span>
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                <strong style={{ color: "var(--ink)" }}>{totalPendente}</strong> pendente(s) de {totalLote} aparelho(s) do
                lote. Clique num status para filtrar.
              </p>
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
              style={{ color: "var(--muted)" }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              type="button"
              onClick={() => setStatusFiltro(null)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={
                statusFiltro == null
                  ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                  : { borderColor: "var(--line)", color: "var(--muted)" }
              }
            >
              Todos · {totalPendente}
            </button>
            {resumo.map(({ status, quantidade }) => {
              const cor = CORES_STATUS[status.slug];
              const ativo = statusFiltro === status.slug;
              return (
                <button
                  key={status.slug}
                  type="button"
                  onClick={() => setStatusFiltro(ativo ? null : status.slug)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={ativo ? { background: cor, color: "#fff", borderColor: cor } : { borderColor: "var(--line)", color: "var(--ink)" }}
                >
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: ativo ? "#fff" : cor }} />
                  {status.label} · {quantidade}
                </button>
              );
            })}
          </div>

          <div className="relative mt-3 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar Trade, OS, IMEI ou modelo"
              className="w-full rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>
        </div>

        {/* lista: só esta parte rola */}
        <div className="flex-1 min-h-0 overflow-auto">
          {erro ? (
            <p className="p-5 text-sm text-red-500">{erro}</p>
          ) : aparelhos == null ? (
            <p className="p-8 text-sm flex items-center justify-center gap-2" style={{ color: "var(--muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Carregando pendências…
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <tr>
                  <th className={th}>Trade Allied</th>
                  <th className={th}>OS Reparadora</th>
                  <th className={th}>OS Care</th>
                  <th className={th}>Modelo</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Dias desde o reconhecimento</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => {
                  const dias = diasDesde(a.data_reconhecimento, hoje);
                  const cor = corDoStatus(a.status_operacional);
                  return (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        {a.trade_allied}
                      </td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        {a.os_reparadora || "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {a.os_care_allied || "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        {a.modelo_comercial || "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink)" }}>
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: cor }} />
                          {a.status_operacional}
                        </span>
                      </td>
                      <td
                        className="px-3 py-1.5 text-right whitespace-nowrap font-semibold"
                        style={{ color: dias != null && dias > 7 ? "#dc2626" : "var(--ink)" }}
                      >
                        {dias != null ? `${dias} d` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs" style={{ color: "var(--muted)" }}>
                      Nenhum aparelho nesse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 px-5 py-2.5 border-t text-[11px]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
          Mostrando {filtrados.length} de {aparelhos?.length ?? 0} pendente(s). Em vermelho: mais de 7 dias desde o
          reconhecimento do lote.
        </div>
      </div>
    </div>
  );
}
