"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, PackageSearch, PlusCircle, X } from "lucide-react";
import { type DetalheValidacaoOrcamento } from "@/lib/orcamentos";
import PopupCadastrarPecaBase from "@/components/PopupCadastrarPecaBase";

export type AparelhoValidacaoDetalhe = DetalheValidacaoOrcamento & {
  id: string;
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
  validacaoConfirmadoSemPeca: boolean;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up com o detalhe de um orçamento em Validação de Orçamentos: valor
// da mão de obra, código de cada peça lançada e o custo/imposto/venda
// dela (sempre a partir do valor mais recente da Base Peças). Peça sem
// custo fica em vermelho com botão pra cadastrar na hora; aparelho sem
// nenhuma peça lançada mostra um botão pra confirmar que vai seguir
// assim mesmo (só mão de obra) — enquanto não confirmado, bloqueia o
// avanço do lote inteiro.
export default function PopupPecasValidacao({
  aparelho,
  podeCadastrarPeca,
  podeConfirmarSemPeca,
  onAtualizado,
  onFechar,
}: {
  aparelho: AparelhoValidacaoDetalhe;
  podeCadastrarPeca: boolean;
  podeConfirmarSemPeca: boolean;
  onAtualizado: () => void;
  onFechar: () => void;
}) {
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const [confirmandoSemPeca, setConfirmandoSemPeca] = useState(false);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);

  async function confirmarSemPeca() {
    setConfirmandoSemPeca(true);
    setErroConfirmar(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/confirmar-sem-peca`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar.");
        setConfirmandoSemPeca(false);
        return;
      }
      onAtualizado();
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
      setConfirmandoSemPeca(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Peças do orçamento
          </h2>
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

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          {aparelho.trade_allied} · OS Reparadora {aparelho.os_reparadora || "—"} · NF Remessa{" "}
          {aparelho.nf_remessa_allied}
        </p>

        {aparelho.pecas.length === 0 ? (
          <div
            className="rounded-xl border p-4 mb-4 space-y-3"
            style={{ borderColor: "#eab308", background: "rgba(234, 179, 8, 0.08)" }}
          >
            <p className="text-sm flex items-center gap-1.5" style={{ color: "#a16207" }}>
              <AlertTriangle size={14} />
              Nenhuma peça lançada pra esse orçamento ainda.
            </p>
            {aparelho.validacaoConfirmadoSemPeca ? (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Check size={13} className="text-emerald-500" />
                Já confirmado — esse aparelho vai seguir sem peça, só com mão de obra.
              </p>
            ) : (
              <>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Se realmente não tem peça nesse reparo, confirme abaixo pra liberar o avanço do lote.
                </p>
                <button
                  type="button"
                  onClick={confirmarSemPeca}
                  disabled={!podeConfirmarSemPeca || confirmandoSemPeca}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#eab308" }}
                  title={podeConfirmarSemPeca ? undefined : "Seu cargo não tem permissão pra confirmar isso."}
                >
                  {confirmandoSemPeca ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Confirmar que segue sem peça
                </button>
                {erroConfirmar && <p className="text-xs text-red-500">{erroConfirmar}</p>}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Código da peça</th>
                  <th className="px-3 py-2 font-medium text-right">Custo (Base Peças)</th>
                  <th className="px-3 py-2 font-medium text-right">Imposto (ICMS)</th>
                </tr>
              </thead>
              <tbody>
                {aparelho.pecas.map((p) => (
                  <tr
                    key={p.posicao}
                    className="border-t"
                    style={{
                      borderColor: p.custo == null ? "#ef4444" : "var(--line)",
                      background: p.custo == null ? "rgba(239, 68, 68, 0.08)" : undefined,
                    }}
                  >
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {p.posicao}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {p.codigo}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: p.custo == null ? "#ef4444" : "var(--ink)" }}>
                      {p.custo == null ? (
                        <span className="inline-flex items-center gap-1.5">
                          Sem custo
                          <button
                            type="button"
                            disabled={!podeCadastrarPeca}
                            onClick={() => setCadastrando(p.codigo)}
                            className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.12)" }}
                            title={podeCadastrarPeca ? "Cadastrar valor dessa peça na Base Peças" : "Sem custo na Base Peças"}
                          >
                            <PlusCircle size={12} />
                            Cadastrar
                          </button>
                        </span>
                      ) : (
                        formatarReal(p.custo)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarReal(p.imposto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="rounded-xl border p-4 space-y-1.5 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Quantidade de peças</span>
            <strong style={{ color: "var(--ink)" }}>{aparelho.quantidadePecas}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Custo das peças</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.custoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.impostoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Venda de peças</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.vendaTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Lucro Total</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarReal(aparelho.lucroTotal)}</strong>
          </div>
        </div>
      </div>

      {cadastrando && (
        <PopupCadastrarPecaBase
          codigo={cadastrando}
          onFechar={() => setCadastrando(null)}
          onSalvo={() => {
            setCadastrando(null);
            onAtualizado();
          }}
        />
      )}
    </div>
  );
}
