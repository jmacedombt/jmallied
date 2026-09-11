"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCheck, Loader2, RefreshCcw, Search, Wrench } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import PopupHistoricoOqc, { type FalhaOqcHistorico } from "@/components/PopupHistoricoOqc";
import PopupReorcamento, { type AparelhoReorcamento } from "@/components/PopupReorcamento";
import { podeConfirmarReparoEmLote, type ConfiguracaoMaoDeObra, type DetalheValidacaoOrcamento } from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AparelhoAgReparo = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
  peca_add_1: string | null;
  peca_add_2: string | null;
  peca_add_3: string | null;
  peca_add_4: string | null;
  peca_add_5: string | null;
  custo_peca_add_1: number | null;
  custo_peca_add_2: number | null;
  custo_peca_add_3: number | null;
  custo_peca_add_4: number | null;
  custo_peca_add_5: number | null;
};

/** Resumo das reprovações de OQC já sofridas por um aparelho que voltou
 * pra "6 - Ag. Reparo" — quantidade (a "1x/2x/3x" pedida) e o histórico
 * completo de motivos, mais recente primeiro (ver PopupHistoricoOqc). */
export type FalhaOqcResumo = { quantidade: number; historico: FalhaOqcHistorico[] };

type Perfil = { cargo: string; is_master: boolean } | null;

// "6 - Ag. Reparo" — mesmo padrão de seleção (individual + em lote) de
// 2 - Ag. Análise. "Reparado" avança o aparelho pra "OQC - Controle de
// Qualidade". Aparelho que já voltou reprovado de um OQC FAIL (ver
// falhasOqc) ganha destaque visual — fundo preto, fonte amarela em
// negrito — e uma tag "OQC FAIL xN" clicável, que abre o histórico dos
// motivos já registrados (ver migration 0037_oqc_avaliacoes.sql).
export default function PainelAgReparo({
  aparelhos,
  topo,
  perfil = null,
  falhasOqc = {},
  faixasMarkup,
  icmsPercentual,
  configMaoDeObra,
  mensagemVazia = "Nenhum aparelho em 6 - Ag. Reparo no momento.",
}: {
  aparelhos: AparelhoAgReparo[];
  topo: React.ReactNode;
  perfil?: Perfil;
  falhasOqc?: Record<string, FalhaOqcResumo>;
  /** parâmetros de cálculo (markup, ICMS, mão de obra) usados pelo
   * pop-up de Reorçamento — buscados uma vez na página (ver
   * operacional/[slug]/page.tsx), igual já é feito em Ag. Análise. */
  faixasMarkup: FaixaMarkup[];
  icmsPercentual: number;
  configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">;
  mensagemVazia?: string;
}) {
  const router = useRouter();

  const [itens, setItens] = useState(aparelhos);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [confirmando, setConfirmando] = useState<AparelhoAgReparo | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalhe, setDetalhe] = useState<AparelhoAgReparo | null>(null);
  const [verHistoricoOqc, setVerHistoricoOqc] = useState<AparelhoAgReparo | null>(null);
  const [reorcamentando, setReorcamentando] = useState<AparelhoAgReparo | null>(null);
  const [destaqueSaida, setDestaqueSaida] = useState<Record<string, "verde" | "vermelho" | "laranja">>({});
  const [saindoAgora, setSaindoAgora] = useState<Set<string>>(new Set());

  useEffect(() => setItens(aparelhos), [aparelhos]);

  const podeLote = podeConfirmarReparoEmLote(perfil);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return itens.filter((a) => {
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      return true;
    });
  }, [itens, buscaOs, buscaTrade]);

  const todosSelecionadosNaTela = filtrados.length > 0 && filtrados.every((a) => selecionados.has(a.id));

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados((atual) => {
      if (todosSelecionadosNaTela) {
        const novo = new Set(atual);
        for (const a of filtrados) novo.delete(a.id);
        return novo;
      }
      const novo = new Set(atual);
      for (const a of filtrados) novo.add(a.id);
      return novo;
    });
  }

  async function animarSaidaDaLista(ids: string[], cor: "verde" | "vermelho" | "laranja") {
    const idsSet = new Set(ids);
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const id of ids) novo.delete(id);
      return novo;
    });
    setDestaqueSaida((atual) => {
      const novo = { ...atual };
      for (const id of ids) novo[id] = cor;
      return novo;
    });
    await esperar(1400);
    setSaindoAgora((atual) => new Set([...atual, ...ids]));
    await esperar(300);
    setItens((atual) => atual.filter((a) => !idsSet.has(a.id)));
    setDestaqueSaida((atual) => {
      const novo = { ...atual };
      for (const id of ids) delete novo[id];
      return novo;
    });
    setSaindoAgora((atual) => {
      const novo = new Set(atual);
      for (const id of ids) novo.delete(id);
      return novo;
    });
    router.refresh();
  }

  async function confirmarReparo() {
    if (!confirmando) return;
    const id = confirmando.id;
    setProcessandoId(id);
    setErroConfirmar(null);

    try {
      const res = await fetch(`/api/operacional/orcamentos/${id}/confirmar-reparo`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar o reparo.");
        setProcessandoId(null);
        return;
      }

      setConfirmando(null);
      setProcessandoId(null);
      await animarSaidaDaLista([id], "verde");
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
      setProcessandoId(null);
    }
  }

  const ATRASO_ONDA_MS = 160;
  const DURACAO_VERDE_MS = 700;
  const DURACAO_SAIDA_MS = 300;

  async function animarConfirmacaoEmOnda(ids: string[]) {
    setSelecionados(new Set());
    for (const id of ids) {
      setDestaqueSaida((atual) => ({ ...atual, [id]: "verde" }));
      (async () => {
        await esperar(DURACAO_VERDE_MS);
        setSaindoAgora((atual) => new Set([...atual, id]));
        await esperar(DURACAO_SAIDA_MS);
        setItens((atual) => atual.filter((a) => a.id !== id));
        setDestaqueSaida((atual) => {
          const novo = { ...atual };
          delete novo[id];
          return novo;
        });
        setSaindoAgora((atual) => {
          const novo = new Set(atual);
          novo.delete(id);
          return novo;
        });
      })();
      await esperar(ATRASO_ONDA_MS);
    }
    await esperar(DURACAO_VERDE_MS + DURACAO_SAIDA_MS);
    router.refresh();
  }

  async function confirmarReparoEmLote() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    setProcessandoLote(true);
    setErroLote(null);

    try {
      const res = await fetch("/api/operacional/orcamentos/confirmar-reparo-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível confirmar os reparos selecionados.");
        setProcessandoLote(false);
        return;
      }

      setConfirmandoLote(false);
      setProcessandoLote(false);
      await animarConfirmacaoEmOnda(ids);
    } catch {
      setErroLote("Falha de conexão. Tente novamente.");
      setProcessandoLote(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaOs}
              onChange={(e) => setBuscaOs(e.target.value)}
              placeholder="Buscar por OS Reparadora"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaTrade}
              onChange={(e) => setBuscaTrade(e.target.value)}
              placeholder="Buscar por Trade Allied"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
        </div>
      </div>

      {podeLote && selecionados.size > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5"
          style={{ borderColor: "var(--accent2)", background: "var(--accent-glow)" }}
        >
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            <strong>{selecionados.size}</strong> selecionado(s)
          </span>
          <button
            type="button"
            onClick={() => setConfirmandoLote(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
            style={{ background: "var(--accent)" }}
          >
            <CheckCheck size={14} />
            Confirmar Reparado ({selecionados.size})
          </button>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium w-8">
                <input
                  type="checkbox"
                  checked={todosSelecionadosNaTela}
                  onChange={alternarSelecionarTodos}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">Trade Allied</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const destaque = destaqueSaida[a.id];
              const saindo = saindoAgora.has(a.id);
              // aparelho que voltou de um "OQC FAIL" — fundo preto e
              // fonte amarela em negrito, pedido explicitamente pelo
              // Rafael pra chamar atenção de quem tá olhando a lista de
              // "6 - Ag. Reparo" que esse não é um reparo de primeira.
              const falha = falhasOqc[a.id];
              const reprovadoNoOqc = !destaque && !!falha && falha.quantidade > 0;
              const corTexto = reprovadoNoOqc ? "#facc15" : undefined;
              return (
                <tr
                  key={a.id}
                  onClick={() => !destaque && setDetalhe(a)}
                  className="border-t cursor-pointer transition-all duration-300 ease-in hover:bg-[var(--surface2)]"
                  style={{
                    borderColor:
                      destaque === "verde"
                        ? "#22c55e"
                        : destaque === "vermelho"
                          ? "#ef4444"
                          : destaque === "laranja"
                            ? "#f97316"
                            : "var(--line)",
                    background:
                      destaque === "verde"
                        ? "rgba(34, 197, 94, 0.22)"
                        : destaque === "vermelho"
                          ? "rgba(239, 68, 68, 0.22)"
                          : destaque === "laranja"
                            ? "rgba(249, 115, 22, 0.22)"
                            : reprovadoNoOqc
                              ? "#000"
                              : "var(--surface)",
                    opacity: saindo ? 0 : 1,
                    transform: saindo ? "translateX(12px)" : "translateX(0)",
                    pointerEvents: destaque ? "none" : undefined,
                  }}
                  title="Clique pra ver as peças e valores desse atendimento"
                >
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selecionados.has(a.id)}
                      onChange={() => alternarSelecao(a.id)}
                      aria-label={`Selecionar ${a.trade_allied}`}
                    />
                  </td>
                  <td
                    className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-bold" : "font-medium"}`}
                    style={{ color: corTexto ?? "var(--ink)" }}
                  >
                    {a.os_reparadora || "—"}
                  </td>
                  <td className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-bold" : ""}`} style={{ color: corTexto ?? "var(--ink)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.trade_allied}
                      {reprovadoNoOqc && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerHistoricoOqc(a);
                          }}
                          title="Ver histórico de reprovações no OQC"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition hover:brightness-110"
                          style={{ background: "#facc15", color: "#000" }}
                        >
                          <AlertTriangle size={10} />
                          OQC FAIL x{falha!.quantidade}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-semibold" : ""}`} style={{ color: corTexto ?? "var(--muted)" }}>
                    {a.os_care_allied}
                  </td>
                  <td className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-semibold" : ""}`} style={{ color: corTexto ?? "var(--muted)" }}>
                    {a.modelo_comercial}
                  </td>
                  <td className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-semibold" : ""}`} style={{ color: corTexto ?? "var(--muted)" }}>
                    {a.sku}
                  </td>
                  <td
                    className={`px-4 py-2.5 ${reprovadoNoOqc ? "font-semibold" : ""}`}
                    style={{ color: corTexto ?? "var(--muted)" }}
                    title={a.descricao_completa ?? ""}
                  >
                    {(a.descricao_completa ?? "").split(" ")[0]}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmando(a)}
                        disabled={processandoId === a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-60"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                        title="Confirmar que o reparo foi realizado"
                      >
                        {processandoId === a.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Wrench size={14} style={{ color: "#9333ea" }} />
                        )}
                        Reparado
                      </button>
                      <button
                        type="button"
                        onClick={() => setReorcamentando(a)}
                        disabled={!a.validacao_snapshot}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[#f97316] disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: "var(--line)", color: "#f97316" }}
                        title={
                          a.validacao_snapshot
                            ? "Pedir reorçamento — peça adicional descoberta durante o reparo"
                            : "Esse orçamento não tem cálculo de peças confirmado — reorçamento indisponível"
                        }
                      >
                        <RefreshCcw size={14} />
                        Reorçamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                        title="Reprovar orçamento"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444] shrink-0"
                        style={{ borderColor: "var(--line)", color: "#ef4444" }}
                      >
                        <Ban size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {itens.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar reparo"
          mensagem={
            <>
              Confirma que o reparo do aparelho <strong>{confirmando.trade_allied}</strong>
              {confirmando.os_reparadora && <> (OS Reparadora {confirmando.os_reparadora})</>} foi realizado? Ele vai
              avançar para <strong>OQC - Controle de Qualidade</strong>.
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={processandoId === confirmando.id}
          erro={erroConfirmar}
          onConfirmar={confirmarReparo}
          onFechar={() => {
            if (processandoId) return;
            setConfirmando(null);
            setErroConfirmar(null);
          }}
        />
      )}

      {confirmandoLote && (
        <PopupConfirmar
          titulo="Confirmar reparos em lote"
          mensagem={
            <>
              Confirma que o reparo dos <strong>{selecionados.size}</strong> aparelho(s) selecionado(s) foi realizado?
              Eles vão avançar para <strong>OQC - Controle de Qualidade</strong>.
            </>
          }
          rotuloConfirmar="Confirmar todos"
          carregando={processandoLote}
          erro={erroLote}
          onConfirmar={confirmarReparoEmLote}
          onFechar={() => {
            if (processandoLote) return;
            setConfirmandoLote(false);
            setErroLote(null);
          }}
        />
      )}

      {reprovando && (
        <PopupReprovarOrcamento
          aparelho={reprovando}
          onFechar={() => setReprovando(null)}
          onReprovado={() => {
            const id = reprovando.id;
            setReprovando(null);
            animarSaidaDaLista([id], "vermelho");
          }}
        />
      )}

      {detalhe && <PopupAtendimentoPecas aparelho={detalhe} onFechar={() => setDetalhe(null)} />}

      {verHistoricoOqc && (
        <PopupHistoricoOqc
          tradeAllied={verHistoricoOqc.trade_allied}
          osReparadora={verHistoricoOqc.os_reparadora}
          historico={falhasOqc[verHistoricoOqc.id]?.historico ?? []}
          onFechar={() => setVerHistoricoOqc(null)}
        />
      )}

      {reorcamentando && reorcamentando.validacao_snapshot && (
        <PopupReorcamento
          aparelho={
            {
              id: reorcamentando.id,
              trade_allied: reorcamentando.trade_allied,
              os_reparadora: reorcamentando.os_reparadora,
              validacao_snapshot: reorcamentando.validacao_snapshot,
              pecasAddIniciais: [
                { posicao: "Extra 1", codigo: reorcamentando.peca_add_1, custo: reorcamentando.custo_peca_add_1 },
                { posicao: "Extra 2", codigo: reorcamentando.peca_add_2, custo: reorcamentando.custo_peca_add_2 },
                { posicao: "Extra 3", codigo: reorcamentando.peca_add_3, custo: reorcamentando.custo_peca_add_3 },
                { posicao: "Extra 4", codigo: reorcamentando.peca_add_4, custo: reorcamentando.custo_peca_add_4 },
                { posicao: "Extra 5", codigo: reorcamentando.peca_add_5, custo: reorcamentando.custo_peca_add_5 },
              ],
            } satisfies AparelhoReorcamento
          }
          faixasMarkup={faixasMarkup}
          icmsPercentual={icmsPercentual}
          configMaoDeObra={configMaoDeObra}
          onFechar={() => setReorcamentando(null)}
          onEnviado={() => {
            const id = reorcamentando.id;
            setReorcamentando(null);
            animarSaidaDaLista([id], "laranja");
          }}
        />
      )}
    </div>
  );
}
