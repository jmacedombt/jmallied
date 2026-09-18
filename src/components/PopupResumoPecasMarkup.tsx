"use client";

import { useMemo, useState } from "react";
import { BarChart3, RotateCcw, X } from "lucide-react";
import { arredondarParaCima, type FaixaMarkup } from "@/lib/bid";
import { type PecaDetalheValidacao } from "@/lib/orcamentos";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarMultiplicador(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function rotuloFaixa(faixa: FaixaMarkup): string {
  const de = formatarReal(faixa.valor_min);
  if (faixa.valor_max == null) return `Acima de ${de}`;
  return `${de} – ${formatarReal(faixa.valor_max)}`;
}

function margemPercentual(venda: number, custo: number, imposto: number): number {
  return venda > 0 ? ((venda - custo - imposto) / venda) * 100 : 0;
}

type LinhaFaixa = {
  faixa: FaixaMarkup;
  quantidade: number;
  custoTotal: number;
  vendaTotalAtual: number;
  impostoTotalAtual: number;
  vendaTotalSimulado: number;
  impostoTotalSimulado: number;
};

function Selo({ percentual }: { percentual: number }) {
  const cor = corPercentualLucro(percentual);
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 font-semibold"
      style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}55` }}
    >
      {formatarPercentual(percentual)}
    </span>
  );
}

/**
 * "Resumo de Peças" de Validação de Orçamentos (pedido explícito) —
 * quebra as peças que estão na tela agora (respeita o filtro de lote
 * selecionado, mesma lista que alimenta os cards do topo) por FAIXA de
 * Markup (Configurações > Faixas de Markup — mesmas faixas usadas de
 * verdade pro cálculo), mostrando quantidade de peças e valor total por
 * faixa. É só CONSULTA — não mexe na configuração real de jeito nenhum.
 *
 * O multiplicador "Simulado" de cada faixa é editável na hora (estado
 * local, nunca salvo em lugar nenhum) — mudar ele recalcula na hora,
 * pra cada peça daquela faixa, a mesma cascata usada de verdade em
 * lib/bid.ts (calcularCustoPecaAllied): teto(custo×mult,2) → +ICMS
 * teto(...,2) → teto(total,0). O objetivo (pedido explícito) é achar,
 * por tentativa, o multiplicador que faça a margem de peças daquela
 * faixa bater pelo menos 30% — por isso o selo de margem usa a mesma
 * escala de cor já usada no resto do sistema (ver corPercentualLucro em
 * CelulaLucroPercentual.tsx): abaixo de 20% vermelho, 20–30% laranja,
 * 30–40% verde, acima de 40% azul.
 */
export default function PopupResumoPecasMarkup({
  pecas,
  faixas,
  icmsPercentual,
  onFechar,
}: {
  pecas: PecaDetalheValidacao[];
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  onFechar: () => void;
}) {
  const [multiplicadores, setMultiplicadores] = useState<number[]>(() => faixas.map((f) => f.multiplicador));

  function restaurarPadrao() {
    setMultiplicadores(faixas.map((f) => f.multiplicador));
  }

  function alterarMultiplicador(indice: number, valor: number) {
    setMultiplicadores((atual) => atual.map((v, i) => (i === indice ? valor : v)));
  }

  const { linhas, semCusto, foraDeFaixa } = useMemo(() => {
    const linhas: LinhaFaixa[] = faixas.map((faixa) => ({
      faixa,
      quantidade: 0,
      custoTotal: 0,
      vendaTotalAtual: 0,
      impostoTotalAtual: 0,
      vendaTotalSimulado: 0,
      impostoTotalSimulado: 0,
    }));
    let semCusto = 0;
    let foraDeFaixa = 0;

    for (const p of pecas) {
      const custo = p.custo;
      if (custo == null) {
        semCusto++;
        continue;
      }
      const indice = faixas.findIndex((f) => custo >= f.valor_min && (f.valor_max === null || custo <= f.valor_max));
      if (indice === -1) {
        foraDeFaixa++;
        continue;
      }
      const linha = linhas[indice];
      linha.quantidade += 1;
      linha.custoTotal += custo;
      linha.vendaTotalAtual += p.vendaPeca ?? 0;
      linha.impostoTotalAtual += p.imposto ?? 0;

      const multiplicadorSimulado = multiplicadores[indice];
      const valorComMargemSim = arredondarParaCima(custo * multiplicadorSimulado, 2);
      const impostoSim = arredondarParaCima(valorComMargemSim * (icmsPercentual / 100), 2);
      const vendaSim = arredondarParaCima(valorComMargemSim + impostoSim, 0);
      linha.vendaTotalSimulado += vendaSim;
      linha.impostoTotalSimulado += impostoSim;
    }

    return { linhas, semCusto, foraDeFaixa };
  }, [pecas, faixas, multiplicadores, icmsPercentual]);

  const totais = useMemo(
    () =>
      linhas.reduce(
        (acc, l) => ({
          quantidade: acc.quantidade + l.quantidade,
          custoTotal: acc.custoTotal + l.custoTotal,
          vendaTotalAtual: acc.vendaTotalAtual + l.vendaTotalAtual,
          impostoTotalAtual: acc.impostoTotalAtual + l.impostoTotalAtual,
          vendaTotalSimulado: acc.vendaTotalSimulado + l.vendaTotalSimulado,
          impostoTotalSimulado: acc.impostoTotalSimulado + l.impostoTotalSimulado,
        }),
        {
          quantidade: 0,
          custoTotal: 0,
          vendaTotalAtual: 0,
          impostoTotalAtual: 0,
          vendaTotalSimulado: 0,
          impostoTotalSimulado: 0,
        }
      ),
    [linhas]
  );

  const houveEdicao = multiplicadores.some((m, i) => m !== faixas[i].multiplicador);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-6xl rounded-2xl border shadow-2xl p-5 max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <BarChart3 size={18} style={{ color: "var(--accent2)" }} />
            Resumo de Peças por Faixa de Markup
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
          Consulta — não altera a configuração de Faixas de Markup (Configurações). Edite o "Mult. simulado" de
          uma faixa pra ver o valor e a margem recalcularem na hora, com as {pecas.length} peça(s) que estão
          nessa tela agora. Objetivo: achar o multiplicador que faça a margem de peças bater pelo menos 30%.
        </p>

        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={restaurarPadrao}
            disabled={!houveEdicao}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <RotateCcw size={12} />
            Restaurar padrão
          </button>
        </div>

        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Faixa (custo)</th>
                <th className="px-3 py-2 font-medium text-right">Mult. hoje</th>
                <th className="px-3 py-2 font-medium text-right">Mult. simulado</th>
                <th className="px-3 py-2 font-medium text-right">Peças</th>
                <th className="px-3 py-2 font-medium text-right">Custo total</th>
                <th className="px-3 py-2 font-medium text-right">Venda total (hoje)</th>
                <th className="px-3 py-2 font-medium text-right">Venda total (simulado)</th>
                <th className="px-3 py-2 font-medium text-right">Margem hoje</th>
                <th className="px-3 py-2 font-medium text-right">Margem simulada</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const margemAtual = margemPercentual(l.vendaTotalAtual, l.custoTotal, l.impostoTotalAtual);
                const margemSimulada = margemPercentual(l.vendaTotalSimulado, l.custoTotal, l.impostoTotalSimulado);
                const editado = multiplicadores[i] !== l.faixa.multiplicador;
                return (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {rotuloFaixa(l.faixa)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarMultiplicador(l.faixa.multiplicador)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={multiplicadores[i]}
                        onChange={(e) => {
                          const valor = Number(e.target.value);
                          if (Number.isFinite(valor) && valor > 0) alterarMultiplicador(i, valor);
                        }}
                        className="w-20 rounded-md border px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent2)] transition"
                        style={{
                          borderColor: editado ? "var(--accent2)" : "var(--line)",
                          background: editado ? "var(--accent-glow)" : "var(--surface2)",
                          color: "var(--ink)",
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                      {l.quantidade}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarReal(l.custoTotal)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarReal(l.vendaTotalAtual)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium" style={{ color: "var(--ink)" }}>
                      {formatarReal(l.vendaTotalSimulado)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.quantidade > 0 ? <Selo percentual={margemAtual} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.quantidade > 0 ? (
                        <Selo percentual={margemSimulada} />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <td className="px-3 py-2" style={{ color: "var(--ink)" }} colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                  {totais.quantidade}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.custoTotal)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.vendaTotalAtual)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.vendaTotalSimulado)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Selo percentual={margemPercentual(totais.vendaTotalAtual, totais.custoTotal, totais.impostoTotalAtual)} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Selo
                    percentual={margemPercentual(totais.vendaTotalSimulado, totais.custoTotal, totais.impostoTotalSimulado)}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {(semCusto > 0 || foraDeFaixa > 0) && (
          <p className="text-xs mt-2 flex items-center gap-3 flex-wrap" style={{ color: "var(--muted)" }}>
            {semCusto > 0 && <span>{semCusto} peça(s) sem custo cadastrado na Base Peças (fora dessa análise).</span>}
            {foraDeFaixa > 0 && <span>{foraDeFaixa} peça(s) com custo fora de qualquer faixa configurada.</span>}
          </p>
        )}
      </div>
    </div>
  );
}
