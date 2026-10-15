"use client";

import { useState } from "react";
import { AlertTriangle, FileCheck2, FileSpreadsheet, Loader2, Lock, PackageCheck, X } from "lucide-react";

export type LinhaResumoEnvio = {
  bloco: "aprovados" | "recusados";
  nfRemessa: string;
  quantidade: number;
  maoDeObra: number;
  vendaPecas: number;
  nfRetorno: string | null;
  nfMaoDeObra: string | null;
  nfPecas: string | null;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Pop-up único (pedido explícito: gate no painel inteiro, não mais por
 * bloco) de "Ag. Emissão de Nota Fiscal" — mostra o resumo de TODAS as
 * NF Remessa prontas (Aprovados e Recusados juntos, cada linha com seu
 * badge de bloco) e tem 2 ações independentes:
 *  - "Emitir planilha de retorno": baixa o Excel "Modelo de Retorno"
 *    (ver lib/modeloRetorno.ts) — não muda status nenhum, pode clicar
 *    quantas vezes quiser, o pop-up continua aberto.
 *  - "Confirmar envio": manda de fato os blocos pra "Produto Entregue".
 *
 * Trava (pedido explícito, 15/10/2026): "Confirmar envio" só libera
 * depois que a planilha de retorno foi emitida com sucesso NESTE pop-up
 * (estado local — ao fechar e abrir de novo, precisa emitir outra vez).
 * Ao emitir, o botão da planilha fica verde e o ícone faz uma animação
 * de confirmação.
 */
export default function PopupConfirmarProdutoEntregue({
  linhas,
  onFechar,
  onEmitirPlanilha,
  onConfirmar,
}: {
  linhas: LinhaResumoEnvio[];
  onFechar: () => void;
  onEmitirPlanilha: () => Promise<void>;
  onConfirmar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [planilhaEmitida, setPlanilhaEmitida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const totalQuantidade = linhas.reduce((soma, l) => soma + l.quantidade, 0);

  async function confirmar() {
    if (!planilhaEmitida) return;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar pra Produto Entregue.");
      setEnviando(false);
    }
  }

  async function emitirPlanilha() {
    setEmitindo(true);
    setErro(null);
    try {
      await onEmitirPlanilha();
      setPlanilhaEmitida(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a planilha de retorno.");
    }
    setEmitindo(false);
  }

  const bloqueado = enviando || emitindo;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !bloqueado && onFechar()}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageCheck size={18} style={{ color: "#22c55e" }} />
            Enviar para Produto Entregue
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={bloqueado}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Resumo de {totalQuantidade} aparelho(s), de {linhas.length} NF Remessa, prontos pra{" "}
          <strong style={{ color: "var(--ink)" }}>Produto Entregue</strong>:
        </p>

        <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Bloco</th>
                <th className="px-3 py-2 font-medium">NF Remessa</th>
                <th className="px-3 py-2 font-medium">Qtd.</th>
                <th className="px-3 py-2 font-medium text-right">Mão de Obra</th>
                <th className="px-3 py-2 font-medium text-right">Vendas Peças</th>
                <th className="px-3 py-2 font-medium">NF Retorno</th>
                <th className="px-3 py-2 font-medium">NF Mão de Obra</th>
                <th className="px-3 py-2 font-medium">NF Peça</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.bloco}:${l.nfRemessa}`} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={
                        l.bloco === "aprovados"
                          ? { background: "rgba(52,211,153,0.14)", color: "#34d399" }
                          : { background: "rgba(248,113,113,0.14)", color: "#f87171" }
                      }
                    >
                      {l.bloco === "aprovados" ? "Aprovado" : "Recusado"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nfRemessa}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                    {l.quantidade}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(l.maoDeObra)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(l.vendaPecas)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nfRetorno || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nfMaoDeObra || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.nfPecas || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <style>{`
          @keyframes planilha-emitida-pop {
            0% { transform: scale(0.4) rotate(-20deg); opacity: 0; }
            55% { transform: scale(1.35) rotate(8deg); opacity: 1; }
            75% { transform: scale(0.9) rotate(-4deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          @keyframes planilha-emitida-brilho {
            0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
            100% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
          }
        `}</style>

        {!planilhaEmitida && (
          <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
            <Lock size={12} />
            Emita a planilha de retorno para liberar o "Confirmar envio".
          </p>
        )}

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {erro}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={emitirPlanilha}
            disabled={bloqueado}
            className="inline-flex items-center gap-2 rounded-lg border text-sm font-medium px-4 py-2.5 transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={
              planilhaEmitida
                ? {
                    borderColor: "#22c55e",
                    color: "#22c55e",
                    background: "rgba(34, 197, 94, 0.12)",
                    animation: "planilha-emitida-brilho 0.9s ease-out 2",
                  }
                : { borderColor: "var(--line)", color: "var(--ink)" }
            }
            title={planilhaEmitida ? "Planilha emitida — clique para baixar de novo" : undefined}
          >
            {emitindo ? (
              <Loader2 size={15} className="animate-spin" />
            ) : planilhaEmitida ? (
              <FileCheck2 size={16} style={{ animation: "planilha-emitida-pop 0.6s ease-out" }} />
            ) : (
              <FileSpreadsheet size={15} />
            )}
            {emitindo ? "Gerando..." : planilhaEmitida ? "Planilha de retorno emitida" : "Emitir planilha de retorno"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={bloqueado}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
              style={{ color: "var(--muted)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={bloqueado || !planilhaEmitida}
              title={!planilhaEmitida ? "Emita a planilha de retorno antes de confirmar o envio" : undefined}
              className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: planilhaEmitida ? "#22c55e" : "#6b7280" }}
            >
              {enviando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : planilhaEmitida ? (
                <PackageCheck size={15} />
              ) : (
                <Lock size={15} />
              )}
              {enviando ? "Enviando..." : "Confirmar envio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
