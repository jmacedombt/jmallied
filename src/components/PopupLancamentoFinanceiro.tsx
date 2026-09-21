"use client";

import { useState } from "react";
import { Landmark, Loader2, Save, X } from "lucide-react";
import { hojeIso, type LinhaFinanceiro } from "@/lib/financeiro";

export type DadosLancamentoFinanceiro = {
  data_emissao: string;
  nf_mao_de_obra_numero: string;
  nf_mao_de_obra_valor: string;
  nf_pecas_numero: string;
  nf_pecas_valor: string;
};

/**
 * Cria um lançamento novo (linha vem em branco) ou edita um já
 * existente (linha vem preenchida) — mesmo formulário nos dois casos.
 * A grande maioria das linhas do Financeiro aparece sozinha (ver
 * registrarLancamentoFinanceiro em lib/financeiro.ts, disparado a partir
 * de Ag. Emissão de Nota Fiscal); isso aqui é o botão "+ Novo
 * lançamento" e o lápis de editar de cada linha — pra cobrir NF que saiu
 * separada da outra, ou corrigir um número/valor digitado errado.
 */
export default function PopupLancamentoFinanceiro({
  linha,
  onFechar,
  onSalvar,
}: {
  /** null = criar um lançamento novo; preenchido = editar esse. */
  linha: LinhaFinanceiro | null;
  onFechar: () => void;
  onSalvar: (dados: DadosLancamentoFinanceiro) => Promise<void>;
}) {
  const [dataEmissao, setDataEmissao] = useState(linha?.dataEmissao ?? hojeIso());
  const [nfMaoDeObraNumero, setNfMaoDeObraNumero] = useState(linha?.nfMaoDeObraNumero ?? "");
  const [nfMaoDeObraValor, setNfMaoDeObraValor] = useState(linha?.nfMaoDeObraValor?.toString() ?? "");
  const [nfPecasNumero, setNfPecasNumero] = useState(linha?.nfPecasNumero ?? "");
  const [nfPecasValor, setNfPecasValor] = useState(linha?.nfPecasValor?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!dataEmissao) {
      setErro("Informe a data de emissão.");
      return;
    }
    if (!nfMaoDeObraNumero.trim() && !nfPecasNumero.trim()) {
      setErro("Informe pelo menos o Nº de uma das duas NFs.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        data_emissao: dataEmissao,
        nf_mao_de_obra_numero: nfMaoDeObraNumero.trim(),
        nf_mao_de_obra_valor: nfMaoDeObraValor.replace(",", "."),
        nf_pecas_numero: nfPecasNumero.trim(),
        nf_pecas_valor: nfPecasValor.replace(",", "."),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar esse lançamento.");
      setSalvando(false);
    }
  }

  const estiloInput: React.CSSProperties = { background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" };
  const classeInput = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition";
  const classeLabel = "block text-xs font-medium mb-1.5";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !salvando && onFechar()}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Landmark size={18} style={{ color: "var(--accent2)" }} />
            {linha ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={classeLabel} style={{ color: "var(--muted)" }}>
              Data de emissão
            </label>
            <input
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
              disabled={salvando}
              className={classeInput}
              style={estiloInput}
            />
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)", background: "rgba(59, 130, 246, 0.06)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink)" }}>
              NF Mão de Obra
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={classeLabel} style={{ color: "var(--muted)" }}>
                  Número
                </label>
                <input
                  value={nfMaoDeObraNumero}
                  onChange={(e) => setNfMaoDeObraNumero(e.target.value)}
                  disabled={salvando}
                  placeholder="Ex.: 123456"
                  className={classeInput}
                  style={estiloInput}
                />
              </div>
              <div>
                <label className={classeLabel} style={{ color: "var(--muted)" }}>
                  Valor (R$)
                </label>
                <input
                  inputMode="decimal"
                  value={nfMaoDeObraValor}
                  onChange={(e) => setNfMaoDeObraValor(e.target.value)}
                  disabled={salvando}
                  placeholder="0,00"
                  className={classeInput}
                  style={estiloInput}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)", background: "rgba(168, 85, 247, 0.06)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink)" }}>
              NF Peças
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={classeLabel} style={{ color: "var(--muted)" }}>
                  Número
                </label>
                <input
                  value={nfPecasNumero}
                  onChange={(e) => setNfPecasNumero(e.target.value)}
                  disabled={salvando}
                  placeholder="Ex.: 123457"
                  className={classeInput}
                  style={estiloInput}
                />
              </div>
              <div>
                <label className={classeLabel} style={{ color: "var(--muted)" }}>
                  Valor (R$)
                </label>
                <input
                  inputMode="decimal"
                  value={nfPecasValor}
                  onChange={(e) => setNfPecasValor(e.target.value)}
                  disabled={salvando}
                  placeholder="0,00"
                  className={classeInput}
                  style={estiloInput}
                />
              </div>
            </div>
          </div>
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">{erro}</p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-60"
            style={{ background: "var(--accent2)" }}
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
