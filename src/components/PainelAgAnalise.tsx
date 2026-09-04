"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, ClipboardCheck, Loader2, Search } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupPecasOrcamento, { type AparelhoComPecas } from "@/components/PopupPecasOrcamento";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { podeImportarBid, type FaixaMarkup, type InfoBidPeca } from "@/lib/bid";

export type AparelhoAgAnalise = AparelhoComPecas & {
  id: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
};

type Perfil = { nome: string; sobrenome: string; cargo: string; is_master: boolean } | null;

const POSICOES = Array.from({ length: 10 }, (_, i) => i + 1);

function pecasFaltandoNoBid(aparelho: AparelhoAgAnalise, precosBid: Record<string, InfoBidPeca>): string[] {
  const faltando: string[] = [];
  for (const n of POSICOES) {
    const peca = aparelho[`peca_${n}` as keyof AparelhoAgAnalise] as string | null;
    if (!peca) continue;
    const info = precosBid[peca];
    if (!info || info.custo_peca_allied == null) faltando.push(peca);
  }
  return faltando;
}

export default function PainelAgAnalise({
  aparelhos,
  topo,
  perfil = null,
  precosBidIniciais = {},
  faixas = [],
  icmsPercentual = 0,
  mensagemVazia = "Nenhum aparelho em Ag. Análise no momento.",
}: {
  aparelhos: AparelhoAgAnalise[];
  topo: React.ReactNode;
  perfil?: Perfil;
  precosBidIniciais?: Record<string, InfoBidPeca>;
  faixas?: FaixaMarkup[];
  icmsPercentual?: number;
  mensagemVazia?: string;
}) {
  const router = useRouter();

  const [itens, setItens] = useState(aparelhos);
  const [precosBid, setPrecosBid] = useState(precosBidIniciais);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [detalhe, setDetalhe] = useState<AparelhoAgAnalise | null>(null);
  const [confirmando, setConfirmando] = useState<AparelhoAgAnalise | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);

  useEffect(() => setItens(aparelhos), [aparelhos]);
  useEffect(() => setPrecosBid(precosBidIniciais), [precosBidIniciais]);

  const podeLote = podeConfirmarAnaliseEmLote(perfil);
  const podeCadastrarBid = podeImportarBid(perfil);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return itens.filter((a) => {
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      return true;
    });
  }, [itens, buscaOs, buscaTrade]);

  const faltandoPorAparelho = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const a of filtrados) mapa.set(a.id, pecasFaltandoNoBid(a, precosBid));
    return mapa;
  }, [filtrados, precosBid]);

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

  async function confirmarAnalise() {
    if (!confirmando) return;
    setProcessandoId(confirmando.id);
    setErroConfirmar(null);

    try {
      const res = await fetch(`/api/operacional/orcamentos/${confirmando.id}/confirmar-analise`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar a análise.");
        setProcessandoId(null);
        return;
      }

      setItens((atual) => atual.filter((a) => a.id !== confirmando.id));
      setSelecionados((atual) => {
        const novo = new Set(atual);
        novo.delete(confirmando.id);
        return novo;
      });
      setConfirmando(null);
      router.refresh();
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
    }

    setProcessandoId(null);
  }

  async function confirmarAnaliseEmLote() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    setProcessandoLote(true);
    setErroLote(null);

    try {
      const res = await fetch("/api/operacional/orcamentos/confirmar-analise-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível confirmar as análises selecionadas.");
        setProcessandoLote(false);
        return;
      }

      const idsSet = new Set(ids);
      setItens((atual) => atual.filter((a) => !idsSet.has(a.id)));
      setSelecionados(new Set());
      setConfirmandoLote(false);
      router.refresh();
    } catch {
      setErroLote("Falha de conexão. Tente novamente.");
    }

    setProcessandoLote(false);
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
            Confirmar Análise realizada ({selecionados.size})
          </button>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              {podeLote && (
                <th className="px-4 py-2.5 font-medium w-8">
                  <input
                    type="checkbox"
                    checked={todosSelecionadosNaTela}
                    onChange={alternarSelecionarTodos}
                    aria-label="Selecionar todos"
                  />
                </th>
              )}
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
              const faltando = faltandoPorAparelho.get(a.id) ?? [];
              const temFaltando = faltando.length > 0;
              return (
                <tr
                  key={a.id}
                  onClick={() => setDetalhe(a)}
                  className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                  style={{
                    borderColor: temFaltando ? "#ef4444" : "var(--line)",
                    background: temFaltando ? "rgba(239, 68, 68, 0.07)" : "var(--surface)",
                  }}
                  title={
                    temFaltando
                      ? `Peça(s) sem custo no BID: ${faltando.join(", ")} — clique pra ver e cadastrar`
                      : "Clique pra ver as peças desse orçamento"
                  }
                >
                  {podeLote && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selecionados.has(a.id)}
                        onChange={() => alternarSelecao(a.id)}
                        aria-label={`Selecionar ${a.trade_allied}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {temFaltando && <AlertTriangle size={13} style={{ color: "#ef4444" }} />}
                      {a.os_reparadora || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {a.trade_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.os_care_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.modelo_comercial}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.sku}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }} title={a.descricao_completa ?? ""}>
                    {(a.descricao_completa ?? "").split(" ")[0]}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setConfirmando(a)}
                      disabled={processandoId === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-60"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      title="Confirmar que a análise foi realizada"
                    >
                      {processandoId === a.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ClipboardCheck size={14} style={{ color: "#14b8a6" }} />
                      )}
                      Análise realizada
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={podeLote ? 8 : 7}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  {itens.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Clique numa linha pra ver as peças lançadas nesse orçamento. Linhas em vermelho têm peça sem custo cadastrado
        no BID.
      </p>

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar análise"
          mensagem={
            <>
              Confirma que a análise do aparelho <strong>{confirmando.trade_allied}</strong>
              {confirmando.os_reparadora && <> (OS Reparadora {confirmando.os_reparadora})</>} foi realizada? Ele vai
              avançar para <strong>Validação de Orçamentos</strong>.
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={processandoId === confirmando.id}
          erro={erroConfirmar}
          onConfirmar={confirmarAnalise}
          onFechar={() => {
            if (processandoId) return;
            setConfirmando(null);
            setErroConfirmar(null);
          }}
        />
      )}

      {confirmandoLote && (
        <PopupConfirmar
          titulo="Confirmar análises em lote"
          mensagem={
            <>
              Confirma que a análise dos <strong>{selecionados.size}</strong> aparelho(s) selecionado(s) foi
              realizada? Eles vão avançar para <strong>Validação de Orçamentos</strong>.
            </>
          }
          rotuloConfirmar="Confirmar todos"
          carregando={processandoLote}
          erro={erroLote}
          onConfirmar={confirmarAnaliseEmLote}
          onFechar={() => {
            if (processandoLote) return;
            setConfirmandoLote(false);
            setErroLote(null);
          }}
        />
      )}

      {detalhe && (
        <PopupPecasOrcamento
          aparelho={detalhe}
          precosBid={precosBid}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          podeCadastrar={podeCadastrarBid}
          onPecaAtualizada={(info) => setPrecosBid((atual) => ({ ...atual, [info.part_number]: info }))}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
