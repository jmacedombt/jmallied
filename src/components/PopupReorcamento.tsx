"use client";

import { useState } from "react";
import { Calculator, RefreshCcw, Save, X } from "lucide-react";
import {
  calcularDetalheReorcamento,
  type ConfiguracaoMaoDeObra,
  type DetalheValidacaoOrcamento,
  type PecaAddEntrada,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import PopupConfirmar from "@/components/PopupConfirmar";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
// mesmo parser tolerante a vírgula (padrão BR) usado em PopupPecasContraProposta/PopupPecasValidacao.
function paraNumero(texto: string): number {
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
function formatarInputNumero(valor: number | null): string {
  return valor == null ? "" : valor.toFixed(2).replace(".", ",");
}

const POSICOES = ["Extra 1", "Extra 2", "Extra 3", "Extra 4", "Extra 5"] as const;

export type AparelhoReorcamento = {
  id: string;
  trade_allied: string;
  os_reparadora: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento;
  /** valores atuais dos 5 campos peca_add_N / custo_peca_add_N — o
   * técnico edita em cima disso (normalmente vazios nesse ponto, já que
   * a peça extra só é descoberta durante o reparo). */
  pecasAddIniciais: { posicao: string; codigo: string | null; custo: number | null }[];
};

type LinhaForm = { posicao: string; codigo: string; custoTexto: string };

// Pop-up "Reorçamento" (botão ao lado de "Reparado" em 6 - Ag. Reparo) —
// o técnico descobriu que precisa de uma peça fora do orçamento original
// durante o reparo. Fluxo em 2 passos, igual pedido pelo Rafael: 1)
// preencher código + custo (visto no GSPN) de cada peça extra e clicar
// "Calcular" — mostra o detalhamento completo (peças já aprovadas +
// peças novas + mão de obra recalculada); 2) "Confirmar e enviar", que
// grava tudo e avança direto pra "4 - Ag. Resposta de Reorçamento". Toda
// edição depois de calcular invalida o resultado (obriga recalcular
// antes de confirmar, pra nunca enviar um número desatualizado).
export default function PopupReorcamento({
  aparelho,
  faixasMarkup,
  icmsPercentual,
  configMaoDeObra,
  onFechar,
  onEnviado,
}: {
  aparelho: AparelhoReorcamento;
  faixasMarkup: FaixaMarkup[];
  icmsPercentual: number;
  configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [linhas, setLinhas] = useState<LinhaForm[]>(
    POSICOES.map((posicao) => {
      const inicial = aparelho.pecasAddIniciais.find((p) => p.posicao === posicao);
      return { posicao, codigo: inicial?.codigo ?? "", custoTexto: formatarInputNumero(inicial?.custo ?? null) };
    })
  );
  const [calculado, setCalculado] = useState<DetalheValidacaoOrcamento | null>(null);
  const [erroCalculo, setErroCalculo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  function invalidarCalculo() {
    setCalculado(null);
    setErroCalculo(null);
  }

  function editarMotivo(texto: string) {
    setMotivo(texto);
    invalidarCalculo();
  }

  function editarLinha(indice: number, campo: "codigo" | "custoTexto", valor: string) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
    invalidarCalculo();
  }

  function calcular() {
    setErroCalculo(null);

    if (!motivo.trim()) {
      setErroCalculo("Informe a justificativa do reorçamento.");
      return;
    }

    const pecasPreenchidas: PecaAddEntrada[] = [];
    for (const l of linhas) {
      const codigoPreenchido = l.codigo.trim() !== "";
      const custoPreenchido = l.custoTexto.trim() !== "";
      if (!codigoPreenchido && !custoPreenchido) continue; // linha vazia, ignora
      if (!codigoPreenchido || !custoPreenchido) {
        setErroCalculo(`Preencha o código E o custo de ${l.posicao}, ou deixe a linha toda vazia.`);
        return;
      }
      const custo = paraNumero(l.custoTexto);
      if (custo <= 0) {
        setErroCalculo(`Informe um custo válido (visto no GSPN) pra ${l.posicao}.`);
        return;
      }
      pecasPreenchidas.push({ posicao: l.posicao, codigo: l.codigo.trim(), custo });
    }

    if (pecasPreenchidas.length === 0) {
      setErroCalculo("Lance pelo menos uma peça adicional (código + custo) pra calcular o reorçamento.");
      return;
    }

    const detalhe = calcularDetalheReorcamento(
      pecasPreenchidas,
      aparelho.validacao_snapshot,
      icmsPercentual,
      configMaoDeObra,
      faixasMarkup
    );
    setCalculado(detalhe);
  }

  async function enviar() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const pecas = linhas
        .filter((l) => l.codigo.trim() !== "" && l.custoTexto.trim() !== "")
        .map((l) => ({ posicao: l.posicao, codigo: l.codigo.trim(), custo: paraNumero(l.custoTexto) }));

      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/reorcamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim(), pecas }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroSalvar(data?.error || "Não foi possível enviar o reorçamento.");
        setSalvando(false);
        setConfirmando(false);
        return;
      }
      onEnviado();
    } catch {
      setErroSalvar("Falha de conexão. Tente novamente.");
      setSalvando(false);
      setConfirmando(false);
    }
  }

  const estiloInput: React.CSSProperties = {
    background: "var(--surface)",
    borderColor: "var(--accent2)",
    color: "var(--ink)",
  };

  const snapshotAtual = aparelho.validacao_snapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "#f97316" }}>
            <RefreshCcw size={18} />
            Reorçamento
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
          {aparelho.trade_allied}
          {aparelho.os_reparadora && <> · OS Reparadora {aparelho.os_reparadora}</>} — peça adicional descoberta
          durante o reparo, fora do orçamento original. Ao confirmar, esse aparelho vai direto pra{" "}
          <strong style={{ color: "var(--ink)" }}>4 - Ag. Resposta de Reorçamento</strong>.
        </p>

        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          Justificativa
        </label>
        <textarea
          value={motivo}
          onChange={(e) => editarMotivo(e.target.value)}
          rows={2}
          placeholder="Ex: aparelho apresentou trinca na tampa traseira, não prevista no orçamento original..."
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition resize-none mb-4"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />

        <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Posição</th>
                <th className="px-3 py-2 font-medium">Peça Add (código)</th>
                <th className="px-3 py-2 font-medium text-right">Custo Peça Add (GSPN)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                    {l.posicao}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={l.codigo}
                      onChange={(e) => editarLinha(i, "codigo", e.target.value)}
                      placeholder="Part Number"
                      className="w-full rounded-md border px-2 py-1 text-sm outline-none font-mono"
                      style={estiloInput}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={l.custoTexto}
                      onChange={(e) => editarLinha(i, "custoTexto", e.target.value)}
                      placeholder="0,00"
                      className="w-32 rounded-md border px-2 py-1 text-right text-sm outline-none"
                      style={estiloInput}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {erroCalculo && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            {erroCalculo}
          </p>
        )}

        <div className="flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={calcular}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition"
            style={{ background: "#f97316" }}
          >
            <Calculator size={13} />
            Calcular
          </button>
        </div>

        {calculado && (
          <div className="rounded-xl border p-4 space-y-3 text-sm mb-4" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Cálculo detalhado
            </span>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                    <th className="px-2.5 py-1.5 font-medium">Posição</th>
                    <th className="px-2.5 py-1.5 font-medium">Código</th>
                    <th className="px-2.5 py-1.5 font-medium text-right">Custo</th>
                    <th className="px-2.5 py-1.5 font-medium text-right">+ Markup</th>
                    <th className="px-2.5 py-1.5 font-medium text-right">+ ICMS</th>
                    <th className="px-2.5 py-1.5 font-medium text-right">Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {calculado.pecas.map((p) => (
                    <tr key={p.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-2.5 py-1.5" style={{ color: "var(--muted)" }}>
                        {p.posicao}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono" style={{ color: "var(--ink)" }}>
                        {p.codigo}
                      </td>
                      <td className="px-2.5 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                        {p.custo != null ? formatarReal(p.custo) : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                        {p.valorComMargem != null ? formatarReal(p.valorComMargem) : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                        {formatarReal(p.imposto)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                        {p.vendaPeca != null ? formatarReal(p.vendaPeca) : "sem faixa"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Inclui as {snapshotAtual.pecas.length} peça(s) já aprovada(s) antes (valor congelado da Validação de
              Orçamentos) + {calculado.pecas.length - snapshotAtual.pecas.length} peça(s) adicional(is) nova(s) acima.
            </p>

            <div className="space-y-1.5 pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>Custo total das peças</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(calculado.custoTotalPecas)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>Imposto (ICMS) total</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(calculado.impostoTotalPecas)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--ink)" }}>Venda de peças (novo total)</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(calculado.vendaTotalPecas)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--muted)" }}>Mão de obra ({calculado.quantidadePecas} peça(s))</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(calculado.maoDeObra)}</strong>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
                <span style={{ color: "var(--ink)" }}>Valor total do reparo</span>
                <strong style={{ color: "var(--accent2)" }}>
                  {formatarReal(calculado.vendaTotalPecas + calculado.maoDeObra)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--ink)" }}>Lucro Total</span>
                <strong style={{ color: "var(--accent2)" }}>{formatarReal(calculado.lucroTotal)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
                <strong style={{ color: corPercentualLucro(calculado.percLucroTotal) }}>
                  {formatarPercentual(calculado.percLucroTotal)}
                </strong>
              </div>
            </div>

            {erroSalvar && !confirmando && <p className="text-xs text-red-500 pt-1">{erroSalvar}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition"
                style={{ background: "#f97316", boxShadow: "0 0 30px rgba(249, 115, 22, 0.35)" }}
              >
                <Save size={13} />
                Confirmar e enviar
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmando && calculado && (
        <PopupConfirmar
          titulo="Confirmar reorçamento"
          mensagem={
            <>
              Esse aparelho vai avançar direto pra <strong>4 - Ag. Resposta de Reorçamento</strong>, com valor total
              do reparo de <strong>{formatarReal(calculado.vendaTotalPecas + calculado.maoDeObra)}</strong>. Confirma?
            </>
          }
          rotuloConfirmar="Confirmar e enviar"
          carregando={salvando}
          erro={erroSalvar}
          onConfirmar={enviar}
          onFechar={() => {
            if (salvando) return;
            setConfirmando(false);
            setErroSalvar(null);
          }}
        />
      )}
    </div>
  );
}
