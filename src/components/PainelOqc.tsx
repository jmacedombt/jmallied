"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import PopupOqcFail, { type AparelhoOqc } from "@/components/PopupOqcFail";
import PopupOqcFailLote from "@/components/PopupOqcFailLote";
import { podeConfirmarOqcEmLote, type DetalheValidacaoOrcamento } from "@/lib/orcamentos";

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AparelhoOqcLista = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

type Perfil = { cargo: string; is_master: boolean } | null;

// "OQC - Controle de Qualidade" — mesmo padrão de seleção (individual +
// em lote) de 2 - Ag. Análise / 6 - Ag. Reparo. "OQC PASS" avança o
// aparelho pra "7 - Reparo Finalizado"; "OQC FAIL" abre o pop-up de
// motivo e volta pra "6 - Ag. Reparo" (ganhando lá o destaque preto/
// amarelo e a tag "OQC FAIL xN" — ver PainelAgReparo.tsx). Ambas gravam
// uma linha em oqc_avaliacoes, base da Métrica de OQC.
export default function PainelOqc({
  aparelhos,
  topo,
  perfil = null,
  mensagemVazia = "Nenhum aparelho em OQC - Controle de Qualidade no momento.",
}: {
  aparelhos: AparelhoOqcLista[];
  topo: React.ReactNode;
  perfil?: Perfil;
  mensagemVazia?: string;
}) {
  const router = useRouter();

  const [itens, setItens] = useState(aparelhos);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [confirmandoPass, setConfirmandoPass] = useState<AparelhoOqcLista | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);
  const [falhando, setFalhando] = useState<AparelhoOqc | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmandoPassLote, setConfirmandoPassLote] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [falhandoLote, setFalhandoLote] = useState(false);

  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalhe, setDetalhe] = useState<AparelhoOqcLista | null>(null);
  const [destaqueSaida, setDestaqueSaida] = useState<Record<string, "verde" | "vermelho">>({});
  const [saindoAgora, setSaindoAgora] = useState<Set<string>>(new Set());

  useEffect(() => setItens(aparelhos), [aparelhos]);

  const podeLote = podeConfirmarOqcEmLote(perfil);

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

  const ATRASO_ONDA_MS = 160;
  const DURACAO_VERDE_MS = 700;
  const DURACAO_SAIDA_MS = 300;

  async function animarConfirmacaoEmOnda(ids: string[], cor: "verde" | "vermelho") {
    setSelecionados(new Set());
    for (const id of ids) {
      setDestaqueSaida((atual) => ({ ...atual, [id]: cor }));
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

  async function confirmarPass() {
    if (!confirmandoPass) return;
    const id = confirmandoPass.id;
    setProcessandoId(id);
    setErroConfirmar(null);

    try {
      const res = await fetch(`/api/operacional/orcamentos/${id}/oqc-pass`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar o OQC PASS.");
        setProcessandoId(null);
        return;
      }

      setConfirmandoPass(null);
      setProcessandoId(null);
      await animarSaidaDaLista([id], "verde");
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
      setProcessandoId(null);
    }
  }

  async function confirmarPassEmLote() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    setProcessandoLote(true);
    setErroLote(null);

    try {
      const res = await fetch("/api/operacional/orcamentos/oqc-pass-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível confirmar os OQC PASS selecionados.");
        setProcessandoLote(false);
        return;
      }

      setConfirmandoPassLote(false);
      setProcessandoLote(false);
      await animarConfirmacaoEmOnda(ids, "verde");
    } catch {
      setErroLote("Falha de conexão. Tente novamente.");
      setProcessandoLote(false);
    }
  }

  async function salvarFailLote(motivo: string) {
    const ids = Array.from(selecionados);
    if (ids.length === 0 || !motivo) return;

    setProcessandoLote(true);
    setErroLote(null);

    try {
      const res = await fetch("/api/operacional/orcamentos/oqc-fail-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, motivo }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroLote(data?.error || "Não foi possível registrar os OQC FAIL selecionados.");
        setProcessandoLote(false);
        return;
      }

      setFalhandoLote(false);
      setProcessandoLote(false);
      await animarConfirmacaoEmOnda(ids, "vermelho");
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
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 flex-wrap"
          style={{ borderColor: "var(--accent2)", background: "var(--accent-glow)" }}
        >
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            <strong>{selecionados.size}</strong> selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFalhandoLote(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
              style={{ background: "#ef4444" }}
            >
              <XCircle size={14} />
              OQC FAIL ({selecionados.size})
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoPassLote(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
              style={{ background: "#16a34a" }}
            >
              <CheckCircle2 size={14} />
              OQC PASS ({selecionados.size})
            </button>
          </div>
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
              return (
                <tr
                  key={a.id}
                  onClick={() => !destaque && setDetalhe(a)}
                  className="border-t cursor-pointer transition-all duration-300 ease-in hover:bg-[var(--surface2)]"
                  style={{
                    borderColor: destaque === "verde" ? "#22c55e" : destaque === "vermelho" ? "#ef4444" : "var(--line)",
                    background:
                      destaque === "verde"
                        ? "rgba(34, 197, 94, 0.22)"
                        : destaque === "vermelho"
                          ? "rgba(239, 68, 68, 0.22)"
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
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setFalhando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })
                        }
                        disabled={processandoId === a.id}
                        title="OQC FAIL — reprovar no controle de qualidade"
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[#ef4444] disabled:opacity-60"
                        style={{ borderColor: "var(--line)", color: "#ef4444" }}
                      >
                        <XCircle size={14} />
                        FAIL
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoPass(a)}
                        disabled={processandoId === a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[#16a34a] disabled:opacity-60"
                        style={{ borderColor: "var(--line)", color: "#16a34a" }}
                        title="OQC PASS — aprovar no controle de qualidade"
                      >
                        {processandoId === a.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        PASS
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

      {confirmandoPass && (
        <PopupConfirmar
          titulo="Confirmar OQC PASS"
          mensagem={
            <>
              Confirma que o aparelho <strong>{confirmandoPass.trade_allied}</strong>
              {confirmandoPass.os_reparadora && <> (OS Reparadora {confirmandoPass.os_reparadora})</>} passou no
              controle de qualidade? Ele vai avançar para <strong>7 - Reparo Finalizado</strong>.
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={processandoId === confirmandoPass.id}
          erro={erroConfirmar}
          onConfirmar={confirmarPass}
          onFechar={() => {
            if (processandoId) return;
            setConfirmandoPass(null);
            setErroConfirmar(null);
          }}
        />
      )}

      {confirmandoPassLote && (
        <PopupConfirmar
          titulo="Confirmar OQC PASS em lote"
          mensagem={
            <>
              Confirma que os <strong>{selecionados.size}</strong> aparelho(s) selecionado(s) passaram no controle de
              qualidade? Eles vão avançar para <strong>7 - Reparo Finalizado</strong>.
            </>
          }
          rotuloConfirmar="Confirmar todos"
          carregando={processandoLote}
          erro={erroLote}
          onConfirmar={confirmarPassEmLote}
          onFechar={() => {
            if (processandoLote) return;
            setConfirmandoPassLote(false);
            setErroLote(null);
          }}
        />
      )}

      {falhando && (
        <PopupOqcFail
          aparelho={falhando}
          onFechar={() => setFalhando(null)}
          onReprovado={() => {
            const id = falhando.id;
            setFalhando(null);
            animarSaidaDaLista([id], "vermelho");
          }}
        />
      )}

      {falhandoLote && (
        <PopupOqcFailLote
          quantidade={selecionados.size}
          salvando={processandoLote}
          erro={erroLote}
          onSalvar={salvarFailLote}
          onFechar={() => {
            if (processandoLote) return;
            setFalhandoLote(false);
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
    </div>
  );
}
