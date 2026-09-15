"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckSquare, Download, ScanBarcode, Search } from "lucide-react";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import PopupBipagemSelecao from "@/components/PopupBipagemSelecao";
import PopupConfirmar from "@/components/PopupConfirmar";
import { gerarExcelExportacaoN3, type ItemExportacaoN3 } from "@/lib/exportN3";
import {
  podeEmitirNfEmLote,
  type DetalheValidacaoOrcamento,
  type CamposPecasComCusto,
  type CamposValorVigente,
} from "@/lib/orcamentos";
import { operacionalRestrito } from "@/lib/usuarios";

type Perfil = { cargo: string; is_master: boolean } | null;

export type AparelhoReparoFinalizado = CamposPecasComCusto &
  CamposValorVigente & {
    id: string;
    os_reparadora: string | null;
    trade_allied: string;
    os_care_allied: string | null;
    modelo_comercial: string | null;
    sku: string | null;
    descricao_completa: string | null;
    validacao_snapshot: DetalheValidacaoOrcamento | null;
    pre_ordem: string | null;
    nf_remessa_allied: string;
  };

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tela de "7 - Reparo Finalizado" — antes usava a tabela genérica
// PainelEtapaSimples (só consulta + reprovar), agora ganhou tela
// própria pra ter a coluna Pré Ordem em destaque e o fluxo de seleção
// manual ou por bipagem (Trade Allied ou OS Reparadora) + "Exportar
// para o N3" — que gera o Excel no formato exato que o N3 espera (ver
// lib/exportN3.ts: DATA_ENCERRAMENTO, SERVICE, PEÇA 1..10/VLR. PEÇA
// 1..10 com as peças Add encaixadas logo após a última peça normal
// preenchida) e move os selecionados pra "Ag. Emissão de Nota Fiscal"
// (status "Ag. NF Serviço / Venda / Retorno"). O botão "Exportar Pré
// Ordem (Excel)" continua à parte — é só uma conferência rápida da
// Pré Ordem, sem mexer no status de ninguém (mesmo formato simples de
// "8 - Orçamento Reprovado"). Continua permitindo reprovar
// individualmente e abrir o pop-up de peças ao clicar na linha, igual
// antes.
export default function PainelReparoFinalizado({
  aparelhos,
  topo,
  perfil = null,
  mensagemVazia = "Nenhum aparelho em 7 - Reparo Finalizado no momento.",
}: {
  aparelhos: AparelhoReparoFinalizado[];
  topo: React.ReactNode;
  perfil?: Perfil;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [itens, setItens] = useState(aparelhos);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalhe, setDetalhe] = useState<AparelhoReparoFinalizado | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bipagemAberta, setBipagemAberta] = useState(false);
  const [confirmandoEmissao, setConfirmandoEmissao] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [erroEmitir, setErroEmitir] = useState<string | null>(null);
  const [destaqueSaida, setDestaqueSaida] = useState<Record<string, boolean>>({});
  const [saindoAgora, setSaindoAgora] = useState<Set<string>>(new Set());

  const podeLote = podeEmitirNfEmLote(perfil);
  // Operacional (sem is_master) só tem função em Ag. Abertura.
  const apenasVisualizacao = operacionalRestrito(perfil);

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

  function selecionarPorBipagem(id: string) {
    setSelecionados((atual) => new Set(atual).add(id));
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

  function exportarSelecionadosExcel() {
    const escolhidos = itens.filter((a) => selecionados.has(a.id));
    gerarExcelExportacaoN3(escolhidos as ItemExportacaoN3[]);
  }

  async function emitirNf() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;

    setEmitindo(true);
    setErroEmitir(null);

    try {
      const res = await fetch("/api/operacional/orcamentos/emitir-nf-servico-venda-retorno-em-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroEmitir(data?.error || "Não foi possível emitir a NF dos selecionados.");
        setEmitindo(false);
        return;
      }

      gerarExcelExportacaoN3(itens.filter((a) => ids.includes(a.id)) as ItemExportacaoN3[]);

      setConfirmandoEmissao(false);
      setBipagemAberta(false);
      setEmitindo(false);

      setDestaqueSaida((atual) => {
        const novo = { ...atual };
        for (const id of ids) novo[id] = true;
        return novo;
      });
      setSelecionados(new Set());
      await esperar(900);
      setSaindoAgora((atual) => new Set([...atual, ...ids]));
      await esperar(300);
      setItens((atual) => atual.filter((a) => !ids.includes(a.id)));
      setDestaqueSaida({});
      setSaindoAgora(new Set());
      router.refresh();
    } catch {
      setErroEmitir("Falha de conexão. Tente novamente.");
      setEmitindo(false);
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

      {podeLote && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 flex-wrap"
          style={{ borderColor: "var(--accent2)", background: "var(--accent-glow)" }}
        >
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            <strong>{selecionados.size}</strong> selecionado(s)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportarSelecionadosExcel}
              disabled={selecionados.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-50"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Download size={14} />
              Exportar Pré Ordem (Excel)
            </button>
            <button
              type="button"
              onClick={() => setBipagemAberta(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)]"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <ScanBarcode size={14} />
              Bipar / Selecionar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoEmissao(true)}
              disabled={selecionados.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              <CheckSquare size={14} />
              Exportar para o N3 ({selecionados.size})
            </button>
          </div>
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
              <th className="px-4 py-2.5 font-medium" style={{ background: "rgba(250, 204, 21, 0.14)" }}>
                Pré Ordem
              </th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const selecionado = selecionados.has(a.id);
              const saindo = saindoAgora.has(a.id);
              const destaque = destaqueSaida[a.id];
              return (
                <tr
                  key={a.id}
                  onClick={() => !destaque && setDetalhe(a)}
                  className="border-t cursor-pointer transition-all duration-300 ease-in hover:bg-[var(--surface2)]"
                  style={{
                    borderColor: selecionado || destaque ? "#22c55e" : "var(--line)",
                    background: selecionado || destaque ? "rgba(34, 197, 94, 0.14)" : "var(--surface)",
                    opacity: saindo ? 0 : 1,
                    transform: saindo ? "translateX(12px)" : "translateX(0)",
                    pointerEvents: destaque ? "none" : undefined,
                  }}
                  title="Clique pra ver as peças e valores desse atendimento"
                >
                  {podeLote && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarSelecao(a.id)}
                        aria-label={`Selecionar ${a.trade_allied}`}
                      />
                    </td>
                  )}
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
                  <td
                    className="px-4 py-2.5 font-semibold"
                    style={{ background: "rgba(250, 204, 21, 0.14)", color: "var(--ink)" }}
                  >
                    {a.pre_ordem || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {!apenasVisualizacao && (
                      <button
                        type="button"
                        onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                        title="Reprovar orçamento"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444]"
                        style={{ borderColor: "var(--line)", color: "#ef4444" }}
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={podeLote ? 9 : 8}
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
        Clique numa linha pra ver as peças e valores desse atendimento.
      </p>

      {reprovando && (
        <PopupReprovarOrcamento
          aparelho={reprovando}
          onFechar={() => setReprovando(null)}
          onReprovado={() => {
            setReprovando(null);
            router.refresh();
          }}
        />
      )}

      {detalhe && <PopupAtendimentoPecas aparelho={detalhe} onFechar={() => setDetalhe(null)} />}

      {bipagemAberta && (
        <PopupBipagemSelecao
          itens={itens}
          selecionados={selecionados}
          onSelecionar={selecionarPorBipagem}
          onEmitir={() => {
            setBipagemAberta(false);
            setConfirmandoEmissao(true);
          }}
          emitindo={false}
          erroEmitir={null}
          rotuloEmitir="Exportar para o N3"
          onFechar={() => setBipagemAberta(false)}
        />
      )}

      {confirmandoEmissao && (
        <PopupConfirmar
          titulo="Exportar para o N3"
          mensagem={
            <>
              Confirma a exportação dos <strong>{selecionados.size}</strong> aparelho(s) selecionado(s)? Vai gerar o
              Excel no formato do N3 e mover todos pra <strong>Ag. Emissão de Nota Fiscal</strong> (status{" "}
              <strong>Ag. NF Serviço / Venda / Retorno</strong>).
            </>
          }
          rotuloConfirmar="Exportar para o N3"
          carregando={emitindo}
          erro={erroEmitir}
          onConfirmar={emitirNf}
          onFechar={() => {
            if (emitindo) return;
            setConfirmandoEmissao(false);
            setErroEmitir(null);
          }}
        />
      )}
    </div>
  );
}
