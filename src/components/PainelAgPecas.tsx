"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCheck, Clock, Gauge, Loader2, PackageCheck, Search, ShoppingCart, Undo2 } from "lucide-react";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import { podeConfirmarChegadaPecaEmLote, podeConfirmarPedidoPecaEmLote, type DetalheValidacaoOrcamento } from "@/lib/orcamentos";

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AparelhoAgPecas = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  pedido_peca_feito: boolean;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

type Perfil = { cargo: string; is_master: boolean } | null;

// "5 - Ag. Peças" — mesmo padrão de seleção (individual + em lote) de
// 2 - Ag. Análise. Cada aparelho passa por: sem pedido -> "Pedido feito"
// (fundo/borda amarela, pode desmarcar se clicado por engano) -> "Peça
// chegou" (fundo/borda verde, avança pra 6 - Ag. Reparo — só libera
// depois que o pedido foi marcado).
export default function PainelAgPecas({
  aparelhos,
  topo,
  perfil = null,
  mensagemVazia = "Nenhum aparelho em 5 - Ag. Peças no momento.",
}: {
  aparelhos: AparelhoAgPecas[];
  topo: React.ReactNode;
  perfil?: Perfil;
  mensagemVazia?: string;
}) {
  const router = useRouter();

  const [itens, setItens] = useState(aparelhos);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [somenteSemPedido, setSomenteSemPedido] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [processandoLotePedido, setProcessandoLotePedido] = useState(false);
  const [processandoLoteChegada, setProcessandoLoteChegada] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalhe, setDetalhe] = useState<AparelhoAgPecas | null>(null);
  const [destaqueSaida, setDestaqueSaida] = useState<Record<string, "verde" | "vermelho">>({});
  const [saindoAgora, setSaindoAgora] = useState<Set<string>>(new Set());

  useEffect(() => setItens(aparelhos), [aparelhos]);

  const podeLotePedido = podeConfirmarPedidoPecaEmLote(perfil);
  const podeLoteChegada = podeConfirmarChegadaPecaEmLote(perfil);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return itens.filter((a) => {
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      if (somenteSemPedido && a.pedido_peca_feito) return false;
      return true;
    });
  }, [itens, buscaOs, buscaTrade, somenteSemPedido]);

  const pedidosFeitos = useMemo(() => itens.filter((a) => a.pedido_peca_feito).length, [itens]);

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

  // "Pedido feito" (ou desmarcar) num aparelho só — não tira ele da
  // lista, só recolore a linha, então basta atualizar o estado local e
  // avisar o servidor.
  async function alternarPedido(a: AparelhoAgPecas) {
    const feito = !a.pedido_peca_feito;
    setProcessandoId(a.id);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${a.id}/pedido-peca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feito }),
      });
      if (res.ok) {
        setItens((atual) => atual.map((x) => (x.id === a.id ? { ...x, pedido_peca_feito: feito } : x)));
      }
    } catch {
      // silencioso — a linha simplesmente não muda, a pessoa tenta de novo
    }
    setProcessandoId(null);
  }

  async function marcarPedidoEmLote() {
    const ids = Array.from(selecionados).filter((id) => {
      const a = itens.find((x) => x.id === id);
      return a && !a.pedido_peca_feito;
    });
    if (ids.length === 0) return;

    setProcessandoLotePedido(true);
    setErroLote(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/pedido-peca-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, feito: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível marcar o pedido em lote.");
        setProcessandoLotePedido(false);
        return;
      }
      setItens((atual) => atual.map((x) => (ids.includes(x.id) ? { ...x, pedido_peca_feito: true } : x)));
      setSelecionados(new Set());
      setProcessandoLotePedido(false);
      router.refresh();
    } catch {
      setErroLote("Falha de conexão. Tente novamente.");
      setProcessandoLotePedido(false);
    }
  }

  async function animarSaidaDaLista(ids: string[], cor: "verde" | "vermelho") {
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

  async function pecaChegou(a: AparelhoAgPecas) {
    setProcessandoId(a.id);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${a.id}/peca-chegou`, { method: "POST" });
      if (res.ok) {
        setProcessandoId(null);
        await animarSaidaDaLista([a.id], "verde");
        return;
      }
    } catch {
      // cai pro fim da função — reabilita o botão
    }
    setProcessandoId(null);
  }

  const ATRASO_ONDA_MS = 160;
  const DURACAO_VERDE_MS = 700;
  const DURACAO_SAIDA_MS = 300;

  async function animarConfirmacaoEmOnda(ids: string[]) {
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

  async function chegadaEmLote() {
    const ids = Array.from(selecionados).filter((id) => {
      const a = itens.find((x) => x.id === id);
      return a && a.pedido_peca_feito;
    });
    if (ids.length === 0) return;

    setProcessandoLoteChegada(true);
    setErroLote(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/peca-chegou-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível confirmar a chegada em lote.");
        setProcessandoLoteChegada(false);
        return;
      }
      setSelecionados(new Set());
      setProcessandoLoteChegada(false);
      await animarConfirmacaoEmOnda(ids);
    } catch {
      setErroLote("Falha de conexão. Tente novamente.");
      setProcessandoLoteChegada(false);
    }
  }

  const selecionadosSemPedido = Array.from(selecionados).filter((id) => {
    const a = itens.find((x) => x.id === id);
    return a && !a.pedido_peca_feito;
  }).length;
  const selecionadosComPedido = Array.from(selecionados).filter((id) => {
    const a = itens.find((x) => x.id === id);
    return a && a.pedido_peca_feito;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">
          {topo}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
            style={{ borderColor: "rgba(202, 138, 4, 0.4)", background: "rgba(202, 138, 4, 0.12)", color: "#ca8a04" }}
            title="Pedido já feito, aguardando a peça chegar fisicamente"
          >
            <ShoppingCart size={12} />
            <strong>{pedidosFeitos}</strong> pedido(s) feito(s), aguardando chegada
          </span>
        </div>

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
          <label
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition hover:border-[var(--accent2)]"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
          >
            <input type="checkbox" checked={somenteSemPedido} onChange={(e) => setSomenteSemPedido(e.target.checked)} />
            Somente sem pedido
          </label>
        </div>
      </div>

      {selecionados.size > 0 && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 flex-wrap"
          style={{ borderColor: "var(--accent2)", background: "var(--accent-glow)" }}
        >
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            <strong>{selecionados.size}</strong> selecionado(s)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {podeLotePedido && (
              <button
                type="button"
                onClick={marcarPedidoEmLote}
                disabled={processandoLotePedido || selecionadosSemPedido === 0}
                title={selecionadosSemPedido === 0 ? "Nenhum selecionado está sem pedido feito" : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#ca8a04" }}
              >
                {processandoLotePedido ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Marcar pedido feito ({selecionadosSemPedido})
              </button>
            )}
            {podeLoteChegada && (
              <button
                type="button"
                onClick={chegadaEmLote}
                disabled={processandoLoteChegada || selecionadosComPedido === 0}
                title={selecionadosComPedido === 0 ? "Nenhum selecionado tem pedido feito ainda" : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)" }}
              >
                {processandoLoteChegada ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                Peça chegou ({selecionadosComPedido})
              </button>
            )}
          </div>
        </div>
      )}

      {erroLote && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erroLote}</p>
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
              <th className="px-4 py-2.5 font-medium">Pedido</th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const destaque = destaqueSaida[a.id];
              const saindo = saindoAgora.has(a.id);
              const processando = processandoId === a.id;
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
                          : a.pedido_peca_feito
                            ? "#ca8a04"
                            : "var(--line)",
                    background:
                      destaque === "verde"
                        ? "rgba(34, 197, 94, 0.22)"
                        : destaque === "vermelho"
                          ? "rgba(239, 68, 68, 0.22)"
                          : a.pedido_peca_feito
                            ? "rgba(202, 138, 4, 0.14)"
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
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {a.os_reparadora || "—"}
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
                  <td className="px-4 py-2.5">
                    {a.pedido_peca_feito ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ color: "#ca8a04", background: "rgba(202, 138, 4, 0.14)", border: "1px solid rgba(202, 138, 4, 0.4)" }}
                      >
                        <ShoppingCart size={11} />
                        Pedido feito
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ color: "var(--muted)", background: "var(--surface2)", border: "1px solid var(--line)" }}
                      >
                        <Clock size={11} />
                        Sem pedido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {!a.pedido_peca_feito ? (
                        <button
                          type="button"
                          onClick={() => alternarPedido(a)}
                          disabled={processando}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[#ca8a04] disabled:opacity-60"
                          style={{ borderColor: "var(--line)", color: "#ca8a04" }}
                          title="Marcar que o pedido dessa peça já foi feito"
                        >
                          {processando ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                          Pedido feito
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => alternarPedido(a)}
                            disabled={processando}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[var(--accent2)] disabled:opacity-60 shrink-0"
                            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                            title="Desmarcar pedido feito (clicou por engano)"
                          >
                            <Undo2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => pecaChegou(a)}
                            disabled={processando}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-60"
                            style={{ borderColor: "var(--line)", color: "#16a34a" }}
                            title="Peça chegou — avança pra 6 - Ag. Reparo"
                          >
                            {processando ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                            Peça chegou
                          </button>
                        </>
                      )}
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
                <td colSpan={9} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {itens.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <Gauge size={12} /> Linhas em amarelo já têm o pedido da peça feito, aguardando chegar. "Peça chegou" só libera
        depois do pedido marcado.
      </p>

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
    </div>
  );
}
